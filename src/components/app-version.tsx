import { formatVersion } from "@/lib/version";

// Values are inlined at build time (see next.config.ts / Dockerfile).
export function AppVersion({ className = "" }: { className?: string }) {
  const label = formatVersion(
    process.env.NEXT_PUBLIC_GIT_SHA,
    process.env.NEXT_PUBLIC_GIT_DATE,
  );
  return (
    <p className={`select-text text-xs text-neutral-400 ${className}`}>
      {label === "unknown" ? label : `v${label}`}
    </p>
  );
}
