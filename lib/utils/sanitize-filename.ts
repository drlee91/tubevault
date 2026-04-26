export function sanitizeFilename(input: string): string {
  return input
    .replace(/[/\\:<>|?*"]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 200);
}
