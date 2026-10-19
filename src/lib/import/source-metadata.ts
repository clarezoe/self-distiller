// Shared validation for caller-supplied `sourceMetadata` (GitHub #38). PURE.

export const SOURCE_METADATA_MAX_BYTES = 4096;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Returns an error string, or null when the metadata is a plain JSON object whose
// serialized form fits the cap.
export function validateSourceMetadata(value: unknown): string | null {
  if (!isPlainObject(value)) return "sourceMetadata must be a JSON object";
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return "sourceMetadata must be JSON-serializable";
  }
  if (Buffer.byteLength(json, "utf8") > SOURCE_METADATA_MAX_BYTES) {
    return `sourceMetadata exceeds ${SOURCE_METADATA_MAX_BYTES} bytes`;
  }
  return null;
}

// Only http(s) URLs may become clickable links; anything else is plain text.
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    // Do not turn embedded credentials into a clickable outbound request. The
    // metadata is untrusted and a browser would otherwise send them to the
    // external host as part of the URL.
    if (u.username || u.password) return null;
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
