import { getResource } from "@/lib/query-resources";
import { runQuery } from "@/lib/fake-query";

// runQuery 拉入 @rfjs/filter-builder + crypto.randomUUID → Node runtime。
export const runtime = "nodejs";

interface Built { params?: Record<string, string>; filter?: unknown }

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const url = new URL(req.url);
  const knob = url.searchParams;

  // 場景旋鈕(spec §5):強制 error / delay / empty 以驅動 UI 狀態。
  const errorCode = Number(knob.get("error"));
  if (errorCode >= 400) return Response.json({ error: "forced" }, { status: errorCode });
  const delay = Number(knob.get("delay"));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const found = getResource(resource);
  if (!found) return Response.json({ error: `unknown resource ${resource}` }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Built;
  const built = { params: body.params ?? {}, filter: body.filter };
  const rows = knob.get("empty") ? [] : found.rows;

  const { items, total, nextCursor } = runQuery(rows, found.columns, found.fields, built);
  const data: Record<string, unknown> = { items, total };
  if (nextCursor !== undefined) data.nextCursor = nextCursor;
  return Response.json({ data });
}
