import { handleRpc, rpcError, userForToken, type JsonRpcRequest, type JsonRpcResponse } from "@/lib/mcp";

// MCP server over Streamable HTTP (stateless, JSON responses). Auth: `Authorization: Bearer fx_…`.
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...CORS, ...extra } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// No server-initiated stream and no sessions: GET/DELETE aren't supported.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}
export const DELETE = GET;

export async function POST(req: Request) {
  const user = await userForToken(req.headers.get("authorization"));
  if (!user) {
    return json(rpcError(null, -32001, "Missing or invalid token. Create one in Fixes → Fixes AI → MCP server."), 401, {
      "WWW-Authenticate": 'Bearer realm="fixes"',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as JsonRpcRequest[];
  if (!messages.length) return json(rpcError(null, -32600, "Invalid request"), 400);

  const results: JsonRpcResponse[] = [];
  for (const m of messages) {
    const r = await handleRpc(m, user);
    if (r) results.push(r);
  }
  // Only notifications/responses were sent → 202 with no body.
  if (!results.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? results : results[0]);
}
