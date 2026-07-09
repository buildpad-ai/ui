/**
 * parseDaaSError
 *
 * `apiRequest` (see `@buildpad/services`) throws
 * `new Error(\`API error: ${status} - ${rawBody}\`)` where `rawBody` is the raw
 * response text. That text is typically JSON in one of two shapes used across
 * the DaaS backend:
 *
 *   - Custom DaaS routes:  `{ error: string }`
 *   - DaaS-compatible: `{ errors: [{ message: string, extensions?: { code?: string } }] }`
 *
 * This helper extracts a clean, human-readable message from either shape —
 * whether embedded in an `apiRequest`-style Error, passed as a raw JSON
 * string, or some other unknown value — and falls back to the raw message
 * text when no known shape is found.
 */
export function parseDaaSError(err: unknown): string {
  const raw = extractRawMessage(err);
  if (!raw) return 'An unknown error occurred';

  const jsonBody = extractJsonBody(raw);
  if (jsonBody) {
    const parsed = tryParseJson(jsonBody);
    if (parsed && typeof parsed === 'object') {
      // DaaS shape: { errors: [{ message, extensions: { code } }] }
      const errors = (parsed as { errors?: unknown }).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0] as { message?: unknown } | undefined;
        if (first && typeof first.message === 'string' && first.message.trim()) {
          return first.message;
        }
      }

      // Custom DaaS shape: { error: string }
      const errorField = (parsed as { error?: unknown }).error;
      if (typeof errorField === 'string' && errorField.trim()) {
        return errorField;
      }
    }
  }

  return raw;
}

/** Normalize any thrown value into a string message. */
function extractRawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  if (err === null || err === undefined) return '';
  return String(err);
}

/**
 * `apiRequest` errors look like `API error: 404 - {"error":"Not found"}`.
 * Strip the `API error: {status} - ` prefix (if present) to isolate the
 * response body, then return it only if it looks like JSON.
 */
function extractJsonBody(message: string): string | null {
  const match = message.match(/^API error:\s*\d+\s*-\s*([\s\S]*)$/);
  const body = (match ? match[1] : message).trim();
  if (body.startsWith('{') || body.startsWith('[')) return body;
  return null;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default parseDaaSError;
