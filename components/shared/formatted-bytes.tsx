import { formatBytes } from "@/lib/utils/format-bytes";

interface Props {
  bytes: number;
  className?: string;
}

export function FormattedBytes({ bytes, className }: Props) {
  return <span className={className}>{formatBytes(bytes)}</span>;
}
