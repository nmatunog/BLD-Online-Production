/**
 * Extract a user-facing error message from unknown errors (including Axios).
 * Use a fallback for non-Error values and missing messages.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = err?.response?.data?.message;
  if (msg != null) return Array.isArray(msg) ? msg.join(', ') : msg;
  if (typeof err?.message === 'string') return err.message;
  return fallback;
}
