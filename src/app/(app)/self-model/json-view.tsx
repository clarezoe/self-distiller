// Tolerant recursive renderer for the open-ended Self Model JSON (PRD §12, §23.8).
// The generated model is intentionally schema-free on the per-context maps, so values can be
// strings, numbers, booleans, arrays, arrays-of-objects, or deeply nested objects. This renderer
// handles ANY shape without crashing (no assumption of flat string fields), hiding empty values
// and humanizing snake_case keys. Pure / server-safe.

export type EvidenceMap = Map<string, { claim: string }>;

// snake_case / camelCase → "Snake case"
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Treat null/undefined/""/whitespace/[]/{} (recursively all-empty) as nothing to show.
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isEmptyValue);
  }
  return false;
}

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function scalarText(value: string | number | boolean): string {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
}

const mutedLabel = "text-xs font-medium uppercase tracking-wide text-neutral-400";

function EvidenceLinks({ ids, map }: { ids: unknown; map: EvidenceMap }) {
  if (!Array.isArray(ids)) return null;
  const known = ids.filter(
    (id): id is string => typeof id === "string" && map.has(id),
  );
  if (known.length === 0) return null;
  return (
    <div>
      <p className={mutedLabel}>Evidence</p>
      <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
        {known.map((id) => (
          <li key={id} title={id}>
            {map.get(id)?.claim}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Render any JSON value. Scalars → text, arrays → lists/blocks, objects → labeled blocks.
export function JsonValue({
  value,
  map,
}: {
  value: unknown;
  map: EvidenceMap;
}) {
  if (isEmptyValue(value)) return null;

  if (isScalar(value)) {
    return <span>{scalarText(value)}</span>;
  }

  if (Array.isArray(value)) {
    const items = value.filter((v) => !isEmptyValue(v));
    if (items.length === 0) return null;
    if (items.every(isScalar)) {
      return (
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((v, i) => (
            <li key={i}>{scalarText(v as string | number | boolean)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((v, i) => (
          <div
            key={i}
            className="border-l-2 border-neutral-200 pl-3 dark:border-neutral-800"
          >
            <JsonValue value={v} map={map} />
          </div>
        ))}
      </div>
    );
  }

  // object
  return <JsonObject obj={value as Record<string, unknown>} map={map} />;
}

function JsonObject({
  obj,
  map,
}: {
  obj: Record<string, unknown>;
  map: EvidenceMap;
}) {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2 text-sm">
      {entries.map(([key, v]) => {
        if (key === "evidence_ids") {
          return <EvidenceLinks key={key} ids={v} map={map} />;
        }
        if (key === "confidence" && typeof v === "number") {
          return (
            <p key={key} className="text-xs text-neutral-400">
              confidence {v}
            </p>
          );
        }
        const label = humanizeKey(key);
        if (isScalar(v)) {
          return (
            <p key={key} className="text-sm">
              <span className="text-neutral-400">{label}: </span>
              {scalarText(v)}
            </p>
          );
        }
        // Nested object/array: label as a sub-heading, value indented underneath.
        return (
          <div key={key} className="space-y-1">
            <p className={mutedLabel}>{label}</p>
            <div className="pl-1">
              <JsonValue value={v} map={map} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
