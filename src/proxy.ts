import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match protected app paths except:
     * - the bearer-token-authenticated firmware ingestion endpoint
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - any file with an extension (images, etc.)
     */
    "/((?!api/firmware/readings|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
