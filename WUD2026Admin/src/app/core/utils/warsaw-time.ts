/** Convert datetime-local explicitly in Warsaw time, including DST validation. */
export function warsawDateTime(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return parts.replace(' ', 'T');
}

export function warsawToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const target = Date.parse(local + ':00Z');
  if (!Number.isFinite(target)) return null;
  let candidate = target;
  for (let index = 0; index < 3; index++) {
    const displayed = warsawDateTime(new Date(candidate).toISOString());
    const displayedUtc = Date.parse(displayed + ':00Z');
    candidate += target - displayedUtc;
  }
  const iso = new Date(candidate).toISOString();
  return warsawDateTime(iso) === local ? iso : null;
}
