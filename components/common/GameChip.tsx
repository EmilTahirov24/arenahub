export default function GameChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
    >
      {name}
    </span>
  );
}
