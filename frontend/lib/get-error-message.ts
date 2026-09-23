const OBJECT_STRING = '[object Object]';

function isBlankOrObjectString(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed === OBJECT_STRING;
}

/**
 * Turn unknown API/Axios/Nest payloads into a single human-readable string.
 * Never returns `[object Object]`.
 */
export function asHumanErrorMessage(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    return isBlankOrObjectString(value) ? fallback : value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return asHumanErrorMessage(value.message, fallback);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => asHumanErrorMessage(item, ''))
      .filter((item) => item && !isBlankOrObjectString(item));
    return parts.length ? parts.join(', ') : fallback;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.message != null) {
      const fromMessage = asHumanErrorMessage(obj.message, '');
      if (fromMessage && !isBlankOrObjectString(fromMessage)) return fromMessage;
    }
    if (obj.error != null) {
      const fromError = asHumanErrorMessage(obj.error, '');
      if (fromError && !isBlankOrObjectString(fromError)) return fromError;
    }
    if (typeof obj.statusText === 'string' && !isBlankOrObjectString(obj.statusText)) {
      return obj.statusText.trim();
    }
  }
  return fallback;
}

/**
 * Extract a user-facing error message from unknown errors (including Axios).
 * Prefers server `message` / `error` / HTTP status text over object stringification.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return asHumanErrorMessage(error, fallback);

  if (error && typeof error === 'object') {
    const axiosErr = error as {
      response?: { status?: number; statusText?: string; data?: unknown };
      message?: string;
    };
    if (axiosErr.response?.data != null) {
      const fromData = asHumanErrorMessage(axiosErr.response.data, '');
      if (fromData && !isBlankOrObjectString(fromData)) return fromData;
    }
    if (
      typeof axiosErr.response?.statusText === 'string' &&
      !isBlankOrObjectString(axiosErr.response.statusText)
    ) {
      return axiosErr.response.statusText.trim();
    }
    if (typeof axiosErr.response?.status === 'number') {
      const fromMessage = asHumanErrorMessage(axiosErr.message, '');
      if (fromMessage && !isBlankOrObjectString(fromMessage)) return fromMessage;
      return `Request failed (${axiosErr.response.status})`;
    }
    if (error instanceof Error) {
      return asHumanErrorMessage(error.message, fallback);
    }
    if (typeof axiosErr.message === 'string') {
      return asHumanErrorMessage(axiosErr.message, fallback);
    }
    return asHumanErrorMessage(error, fallback);
  }

  return fallback;
}
