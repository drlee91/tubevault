import { NextResponse } from "next/server";
import type { SelfCheckResult } from "@/lib/services/self-check-service";
import { ensureBooted } from "@/lib/boot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await ensureBooted();
    const result = await ctx.selfCheckService.runAll();
    return NextResponse.json(result);
  } catch (err) {
    const synthetic: SelfCheckResult = {
      overall: "error",
      checks: [
        {
          name: "boot",
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        },
      ],
    };
    return NextResponse.json(synthetic, { status: 200 });
  }
}
