export function todayString(): string {
  const d = new Date();
  return formatDate(d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function displayDate(dateStr: string): string {
  const today = todayString();
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getPastDays(n: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(formatDate(d));
  }
  return days;
}

// Compact relative label for a past YYYY-MM-DD date: "today", "yesterday",
// "3d ago", "2w ago", or a short month/day once it's further back.
export function relativeDateLabel(dateStr: string): string {
  const today = todayString();
  if (dateStr === today) return 'today';
  const then = parseDate(dateStr);
  const days = Math.round((parseDate(today).getTime() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.round(days / 7)}w ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Formats a millisecond duration as M:SS, or H:MM:SS once it passes an hour.
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
