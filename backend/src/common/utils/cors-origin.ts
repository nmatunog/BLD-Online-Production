export function isAllowedCorsOrigin(origin: string, extraAllowed: string[] = []): boolean {
  const lower = origin.toLowerCase();
  if (
    extraAllowed.some(
      (allowed) => lower === allowed.toLowerCase() || lower.startsWith(allowed.toLowerCase()),
    )
  ) {
    return true;
  }

  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      host === 'bldcebu.com' ||
      host.endsWith('.bldcebu.com') ||
      host.endsWith('.run.app')
    );
  } catch {
    return false;
  }
}
