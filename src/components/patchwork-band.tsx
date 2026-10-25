// A thin row of quilt pieces used to separate big sections.
const pieces = ["bg-marigold", "bg-okra", "bg-hibiscus", "bg-denim", "bg-shell", "bg-marigold", "bg-ink", "bg-hibiscus"];
const widths = [3, 5, 2, 4, 3, 6, 2, 5, 3, 4, 2, 5];

export function PatchworkBand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex h-4 w-full overflow-hidden ${className}`} aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <div key={i} className={pieces[(i * 5) % pieces.length]} style={{ flexGrow: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
