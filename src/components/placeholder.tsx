export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-prose text-sm text-neutral-500">{note}</p>
      <p className="text-xs text-neutral-400">Coming in a later phase.</p>
    </div>
  );
}
