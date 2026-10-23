export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysAgo(ts: number, now = Date.now()): number {
  return Math.floor((now - ts) / 86_400_000);
}

/** "2× Coke Mismo, 1× Marlboro Red (pack)" */
export function itemsSummary(items: { qty: number; name: string; unitName: string }[], max = 3): string {
  const parts = items.slice(0, max).map((i) => `${i.qty}× ${i.name}${i.unitName ? ` (${i.unitName})` : ''}`);
  if (items.length > max) parts.push(`+${items.length - max} more`);
  return parts.join(', ');
}

/** "Thu, Oct 23, 3:05 PM" */
export function formatDayTime(ts: number): string {
  return new Date(ts).toLocaleString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
