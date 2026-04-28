interface Props {
  seconds: number | null;
}

export function Duration({ seconds }: Props) {
  if (seconds === null || seconds === undefined) return <span>—</span>;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const text =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  return <span className="tabular-nums">{text}</span>;
}
