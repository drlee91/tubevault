const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function matchesYouTubeUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return YT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function parseYouTubeUrl(
  input: string,
): { kind: "playlist" | "video"; externalId: string } | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(url.hostname)) return null;

  const list = url.searchParams.get("list");
  if (list) return { kind: "playlist", externalId: list };

  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\/+/, "");
    return id ? { kind: "video", externalId: id } : null;
  }

  if (url.pathname === "/watch") {
    const v = url.searchParams.get("v");
    return v ? { kind: "video", externalId: v } : null;
  }

  const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
  if (shortsMatch) return { kind: "video", externalId: shortsMatch[1]! };

  return null;
}
