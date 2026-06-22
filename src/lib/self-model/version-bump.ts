// Pure version-bump logic — no DB import, so it is unit-testable in isolation.
// "0.1" → "0.2"; "1.9" → "2.0"; missing/invalid → "0.1". Minor bumps per user-approved update.
export function nextVersion(current?: string | null): string {
  if (!current) return "0.1";
  const m = /^(\d+)\.(\d+)$/.exec(current.trim());
  if (!m) return "0.1";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (minor >= 9) return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}
