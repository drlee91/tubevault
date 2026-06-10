const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  return i === 0 ? `${n} ${UNITS[i]}` : `${n.toFixed(1)} ${UNITS[i]}`;
}
