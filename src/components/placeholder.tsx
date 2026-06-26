export function Placeholder({
  title,
  note,
  comingSoon,
}: {
  title: string;
  note: string;
  comingSoon: string;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-prose text-sm text-neutral-500">{note}</p>
      <p className="text-xs text-neutral-400">{comingSoon}</p>
    </div>
  );
}
