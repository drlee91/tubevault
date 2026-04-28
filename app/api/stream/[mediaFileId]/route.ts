import { promises as fs, createReadStream } from "node:fs";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { mimeForFormat } from "@/lib/services/media-file-service";

interface RouteContext {
  params: Promise<{ mediaFileId: string }>;
}

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const { mediaFileId } = await context.params;
  const id = Number(mediaFileId);
  if (!Number.isFinite(id)) return new Response("Not Found", { status: 404 });

  const ctx = await ensureBootedOrTest();
  const file = ctx.mediaFileService.byId(id);
  if (!file) return new Response("Not Found", { status: 404 });

  let stat;
  try {
    stat = await fs.stat(file.filePath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  const size = stat.size;

  const range = parseRange(req.headers.get("range"), size);
  if (range === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const partial = range !== null;
  const length = end - start + 1;

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": mimeForFormat(file.format),
    "Content-Length": String(length),
    "Cache-Control": "private, max-age=3600",
    "Last-Modified": stat.mtime.toUTCString(),
  });
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const node = createReadStream(file.filePath, { start, end });
  const body = nodeToWeb(node);
  return new Response(body, { status: partial ? 206 : 200, headers });
}

interface Range { start: number; end: number; }
function parseRange(header: string | null, size: number): Range | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  const startStr = m[1]!;
  const endStr = m[2]!;
  if (startStr === "" && endStr === "") return "invalid";
  let start: number;
  let end: number;
  if (startStr === "") {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? size - 1 : Number(endStr);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (start < 0 || start >= size || end < start || end >= size) return "invalid";
  return { start, end };
}

function nodeToWeb(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    },
  });
}
