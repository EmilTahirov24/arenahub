function MapIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color }}>
      <path
        fill="currentColor"
        d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Zm0 2.2 6 2v13.6l-6-2V5.2ZM5 6.5l2-.7v13.6l-2 .8V6.5Zm14 11-2 .7V5.6l2-.8v12.7Z"
      />
    </svg>
  );
}

export default function MapCard({
  mapName,
  order,
  teamAScore,
  teamBScore,
  status,
  accentColor,
  tba,
  label,
}: {
  mapName: string;
  order: number;
  teamAScore?: number;
  teamBScore?: number;
  status?: string;
  accentColor: string;
  tba?: boolean;
  label?: string;
}) {
  const isLive = status === "LIVE";

  return (
    <div
      className={`overflow-hidden rounded-lg border ${isLive ? "border-live/50" : "border-border-subtle"} ${tba ? "opacity-60" : ""}`}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: `linear-gradient(90deg, ${accentColor}26, transparent)` }}
      >
        <MapIcon color={accentColor} />
        <span className="text-xs font-semibold text-foreground-muted">#{order}</span>
        <span className="font-display flex-1 truncate text-sm font-bold">{tba ? "TBA" : mapName}</span>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-live">
            <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-live" />
            LIVE
          </span>
        )}
      </div>
      <div className="flex items-center justify-center bg-surface py-3">
        {tba ? (
          <span className="text-xs text-foreground-muted">{label}</span>
        ) : (
          <span className="font-display tabular-nums text-xl font-bold">
            {teamAScore} : {teamBScore}
          </span>
        )}
      </div>
    </div>
  );
}
