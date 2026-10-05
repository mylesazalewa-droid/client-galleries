import { cookies } from "next/headers";
import { OWNER_COOKIE } from "@/lib/owner";

export const runtime = "nodejs";

export async function POST(req: Request) {
  (await cookies()).delete(OWNER_COOKIE);
  return Response.redirect(new URL("/admin", req.url), 303);
}
