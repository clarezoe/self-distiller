/** Format the build version label: `<sha> · <date>`. Pure; unit-tested. */
export function formatVersion(sha?: string, date?: string): string {
  const s = (sha ?? "").trim();
  const d = (date ?? "").trim();
  if (!s || s === "unknown") return "unknown";
  return d ? `${s} · ${d}` : s;
}
