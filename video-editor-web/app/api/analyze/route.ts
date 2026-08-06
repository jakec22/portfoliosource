import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildUserContentBlocks, SYSTEM_PROMPT } from "@/lib/prompt";
import { editPlansSchema, editPlansToolInputSchema } from "@/lib/schema";
import type { AnalyzeRequestBody, AnalyzeResponseBody } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const TOOL_NAME = "propose_edit_plans";

/**
 * This is the one server hop the app needs: it holds the Anthropic API key
 * (never exposed to the browser), sends the clip frames + transcript-free
 * metadata + user guidelines to Claude, and returns validated EditPlan JSON.
 * No video bytes are ever sent here — only small extracted frames.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Copy .env.local.example to .env.local and set it." },
      { status: 500 },
    );
  }

  let body: AnalyzeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.clips || body.clips.length === 0) {
    return NextResponse.json({ error: "At least one clip is required" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: TOOL_NAME,
        description: "Propose 2-4 candidate edit plans for combining the given clips into one video.",
        input_schema: editPlansToolInputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildUserContentBlocks(body.guidelines, body.clips),
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    return NextResponse.json({ error: "AI did not return a structured edit plan" }, { status: 502 });
  }

  const parsed = editPlansSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "AI response did not match the expected edit plan schema", details: parsed.error.flatten() },
      { status: 502 },
    );
  }

  const knownClipIds = new Set(body.clips.map((c) => c.id));
  for (const plan of parsed.data.plans) {
    for (const segment of plan.segments) {
      if (!knownClipIds.has(segment.clipId)) {
        return NextResponse.json(
          { error: `AI referenced unknown clip id "${segment.clipId}"` },
          { status: 502 },
        );
      }
    }
  }

  const result: AnalyzeResponseBody = { plans: parsed.data.plans };
  return NextResponse.json(result);
}
