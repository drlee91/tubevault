interface Props {
  bytes: number;
  className?: string;
}

const units = ["B", "KB", "MB", "GB", "TB"] as const;

export function FormattedBytes({ bytes, className }: Props) {
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const text = i === 0 ? `${n} ${units[i]}` : `${n.toFixed(1)} ${units[i]}`;
  return <span className={className}>{text}</span>;
}
