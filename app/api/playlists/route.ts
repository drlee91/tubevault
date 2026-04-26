import { NextResponse } from "next/server";
import { ensureBooted } from "@/lib/boot";
import { CreatePlaylistBody } from "@/lib/api/schemas";
import { parseJsonBody, jsonError } from "@/lib/api/helpers";

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, CreatePlaylistBody);
    const ctx = await ensureBooted();
    const result = await ctx.playlistService.create(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET() {
  try {
    const ctx = await ensureBooted();
    return NextResponse.json({ playlists: ctx.playlistService.list() });
  } catch (err) {
    return jsonError(err);
  }
}
