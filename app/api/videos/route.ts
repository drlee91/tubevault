import { NextResponse } from "next/server";
import { ensureBooted } from "@/lib/boot";
import { AddVideoBody } from "@/lib/api/schemas";
import { parseJsonBody, jsonError, ensureBootedOrTest } from "@/lib/api/helpers";

export async function GET(_req: Request) {
  const ctx = await ensureBootedOrTest();
  const videos = ctx.videoService.listStandaloneWithKinds();
  return Response.json({ videos });
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, AddVideoBody);
    const ctx = await ensureBooted();
    const result = await ctx.videoService.addStandalone(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
