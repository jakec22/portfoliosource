// Extracts purchase transactions from an uploaded bank/credit-card statement
// via the Claude API. Calls the Messages API directly with fetch rather than
// the @anthropic-ai/sdk package — that SDK targets Node/browser environments
// and doesn't bundle cleanly into React Native/Hermes, whereas native fetch
// against a JSON REST endpoint is the standard approach for a mobile client.
//
// This is a one-shot extraction, not an agentic loop: one request in, one
// structured JSON array of transactions out. Structured outputs
// (output_config.format) guarantee the response is valid, schema-conforming
// JSON, so no tool-use loop or retries are needed.

import { CATEGORIES } from '../data/seed';

const MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export interface ParsedTransaction {
  /** ISO date as given on the statement, "YYYY-MM-DD" (best effort). */
  date: string;
  /** Merchant / description text, exactly as shown on the statement. */
  merchant: string;
  /** Amount in cents. Always a positive integer. */
  amountCents: number;
  categoryId: string;
}

export class ImportError extends Error {}

function buildSchema() {
  return {
    type: 'object',
    properties: {
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Transaction date, YYYY-MM-DD' },
            merchant: {
              type: 'string',
              description: 'Merchant or description exactly as shown on the statement',
            },
            amount: {
              type: 'number',
              description: 'Purchase amount in dollars, always a positive number',
            },
            categoryId: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
          },
          required: ['date', 'merchant', 'amount', 'categoryId'],
          additionalProperties: false,
        },
      },
    },
    required: ['transactions'],
    additionalProperties: false,
  } as const;
}

function buildPrompt(): string {
  const categoryLines = CATEGORIES.map((c) => `- ${c.id}: ${c.name} — ${c.hint}`).join('\n');
  return `You are extracting individual purchase transactions from a bank or credit card statement so they can be logged into a family budget app.

Extract every individual purchase (debit) line item visible in the document. For each one, assign it to the single best-fit category from this list, using the hints as a guide:

${categoryLines}

If a purchase doesn't clearly fit one of the other categories, use "misc".

Do NOT include: payments or transfers made to the card, refunds or credit vouchers, one-time fees, or interest charges — only actual purchases.`;
}

/**
 * Validates and maps the raw Anthropic API response body into transactions.
 * Pulled out from parseStatement() so it can be unit-tested without a
 * network call — this is where a malformed or partial model response is
 * caught before it reaches app state.
 */
export function parseResponseJson(data: {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
}): ParsedTransaction[] {
  if (data.stop_reason === 'refusal') {
    throw new ImportError("Claude couldn't process that file. Try a different statement.");
  }

  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new ImportError('No transactions came back — try again.');
  }

  let parsed: { transactions?: unknown };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new ImportError("Couldn't read the response — try again.");
  }

  const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
  const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];

  const results: ParsedTransaction[] = [];
  for (const t of rawTransactions) {
    if (
      typeof t !== 'object' ||
      t === null ||
      typeof (t as Record<string, unknown>).date !== 'string' ||
      typeof (t as Record<string, unknown>).merchant !== 'string' ||
      typeof (t as Record<string, unknown>).amount !== 'number' ||
      !Number.isFinite((t as Record<string, unknown>).amount as number) ||
      ((t as Record<string, unknown>).amount as number) <= 0
    ) {
      continue; // Skip malformed rows rather than failing the whole import.
    }
    const row = t as { date: string; merchant: string; amount: number; categoryId?: unknown };
    const categoryId = validCategoryIds.has(row.categoryId as string) ? (row.categoryId as string) : 'misc';
    results.push({
      date: row.date,
      merchant: row.merchant.trim(),
      amountCents: Math.round(row.amount * 100),
      categoryId,
    });
  }
  return results;
}

interface ParseInput {
  apiKey: string;
  /** Base64-encoded PDF data, or plain UTF-8 text content (CSV/plain text). */
  content: string;
  isPdf: boolean;
}

export async function parseStatement({ apiKey, content, isPdf }: ParseInput): Promise<ParsedTransaction[]> {
  const userContent = isPdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content } },
        { type: 'text', text: buildPrompt() },
      ]
    : [{ type: 'text', text: `${buildPrompt()}\n\nStatement contents:\n\n${content}` }];

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: userContent }],
        output_config: { format: { type: 'json_schema', schema: buildSchema() } },
      }),
    });
  } catch {
    throw new ImportError('Network error — check your connection and try again.');
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ImportError('That API key was rejected. Check it and try again.');
    }
    if (response.status === 429) {
      throw new ImportError('Rate limited — wait a moment and try again.');
    }
    const body = await response.text().catch(() => '');
    throw new ImportError(`Import failed (${response.status}). ${body.slice(0, 200)}`.trim());
  }

  const data = await response.json();
  return parseResponseJson(data);
}
