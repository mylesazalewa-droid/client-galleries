import { isDemo } from "@/lib/config";
import { writeSession } from "@/lib/owner";

export const runtime = "nodejs";

/** Demo mode only: look around the dashboard without Google. Nothing can be changed. */
export async function POST(req: Request) {
  if (!isDemo) return new Response("Not available", { status: 404 });
  await writeSession({ email: "demo", demo: true });
  return Response.redirect(new URL("/admin", req.url), 303);
}
