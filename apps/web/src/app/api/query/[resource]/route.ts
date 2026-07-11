import { getResource } from "@/lib/query-resources";
import { runQuery } from "@/lib/fake-query";

// runQuery 拉入 @rfjs/filter-builder + crypto.randomUUID → Node runtime。
export const runtime = "nodejs";

interface Built { params: Record<string, string>; filter?: unknown }

const KNOBS = new Set(["delay", "error", "empty"]);

// knobs(delay/error/empty)恆在 querystring;GET 的 params/filter 也在 querystring,
// POST 的則在 body —— 兩者最後都收斂成 Built 交給共用的 respond()。
async function respond(resource: string, knob: URLSearchParams, built: Built): Promise<Response> {
  const errorCode = Number(knob.get("error"));
  if (errorCode >= 400) return Response.json({ error: "forced" }, { status: errorCode });
  const delay = Number(knob.get("delay"));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const found = getResource(resource);
  if (!found) return Response.json({ error: `unknown resource ${resource}` }, { status: 404 });

  const rows = knob.get("empty") ? [] : found.rows;
  const { items, total, nextCursor } = runQuery(rows, found.columns, found.fields, built);
  const data: Record<string, unknown> = { items, total };
  if (nextCursor !== undefined) data.nextCursor = nextCursor;
  return Response.json({ data });
}

export async function GET(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const qs = new URL(req.url).searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of qs) if (!KNOBS.has(k) && k !== "filter") params[k] = v;
  const raw = qs.get("filter");
  let filter: unknown;
  if (raw) {
    try {
      filter = JSON.parse(raw);
    } catch {
      return Response.json({ error: "bad filter" }, { status: 400 });
    }
  }
  return respond(resource, qs, { params, filter });
}

export async function POST(req: Request, ctx: { params: Promise<{ resource: string }> }): Promise<Response> {
  const { resource } = await ctx.params;
  const qs = new URL(req.url).searchParams;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { filter, ...rest } = body;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) params[k] = String(v);
  return respond(resource, qs, { params, filter });
}
