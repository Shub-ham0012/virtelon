import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@virtelon/types";

/** Server-component/action helper: returns the current session's user or
 * redirects to /login. Every (dashboard) route calls this first. */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}
