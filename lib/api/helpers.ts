import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { mapErrorToResponse } from "./errors";

export async function parseJsonBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json);
}

export function jsonError(err: unknown): NextResponse {
  const { status, body } = mapErrorToResponse(err);
  return NextResponse.json(body, { status });
}
