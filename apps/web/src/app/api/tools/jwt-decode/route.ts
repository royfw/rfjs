import { Jwt } from "@rfjs/jwt";

// @rfjs/jwt wraps jsonwebtoken (require('crypto')) → Node runtime only.
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const token =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!token) {
    return Response.json({ ok: false, error: "badRequest" }, { status: 400 });
  }

  const decoded = Jwt.decodeComplete(token);
  if (!decoded) {
    return Response.json({ ok: false, error: "invalidJwt" });
  }

  const { header, payload, signature } = decoded;
  return Response.json({ ok: true, header, payload, signature });
}
