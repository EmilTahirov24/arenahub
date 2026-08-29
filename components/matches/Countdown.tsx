"use client";

import { useEffect, useState } from "react";

function diffParts(target: number) {
  const ms = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, done: ms <= 0 };
}

export default function Countdown({ target, locale }: { target: string; locale: string }) {
  const targetMs = new Date(target).getTime();
  const [parts, setParts] = useState(() => diffParts(targetMs));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) {
    return <span className="font-display text-sm font-semibold text-live">{locale === "az" ? "Başlayır..." : "Starting..."}</span>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const label = parts.days > 0 ? `${parts.days}g ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}` : `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;

  return (
    <span className="font-display tabular-nums text-lg font-bold text-brand-via-fg">{label}</span>
  );
}
