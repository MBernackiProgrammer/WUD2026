/** Only navigable seller addresses are exposed as purchase links. */
export function ticketUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}
