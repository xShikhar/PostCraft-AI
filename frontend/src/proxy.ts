import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const api = process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${api}${dev ? " ws: http://localhost:8000" : ""}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${dev ? "" : " upgrade-insecure-requests;"}`;
  const incoming = new Headers(request.headers);
  incoming.set("x-nonce", nonce);
  incoming.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: incoming } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  if (!dev) response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}
export const config = { matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|logo-light.png|logo-dark.png).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }] };
