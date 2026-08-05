import { NextResponse, type NextRequest } from "next/server";

// Authentication is checked by the dashboard server component. Keeping
// middleware dependency-free prevents an unavailable/misconfigured third-party
// auth endpoint from turning every matched request into a Vercel Edge 500.
export async function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}
export const config = { matcher: ["/dashboard/:path*"] };
