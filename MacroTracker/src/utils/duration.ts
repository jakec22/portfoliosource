// Helpers for time-based exercise durations (planks, carries, intervals).

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Seconds -> "m:ss" (or "h:mm:ss" past an hour). 90 -> "1:30", 45 -> "0:45".
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Parse user input into seconds. Accepts "1:30" (=90), bare "90" (=90 seconds),
// "1:30:00" (h:mm:ss), and partial entries like "1:" while typing.
export function parseDuration(input: string): number {
  const cleaned = input.trim();
  if (!cleaned) return 0;
  const parts = cleaned.split(':').map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  if (parts.length === 1) return parts[0]; // bare number = seconds
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
