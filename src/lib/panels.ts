import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Session guard for pages and layouts.
 *
 * A visitor without a valid session belongs on the login page, and for a page a
 * `307` redirect is the correct, SEO-friendly answer. This must only ever be
 * called from a page, layout or server component — never from a route handler
 * (see `requireApiRole` for those).
 */
export async function requireRole(role: Role) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.user.role !== role) redirect(`/${current.user.role.toLowerCase()}`);
  return current;
}

/**
 * Session guard for route handlers.
 *
 * The old code called `requireRole` here too, which was wrong in a way that
 * looked harmless and was not. `redirect()` in a route handler sends a `307` to
 * the login page, and `fetch` follows redirects silently, so the caller
 * received `200 text/html`. Every component then ran `.json()` on the login page
 * and died with `Unexpected token '<'` — the "DOCTYPE is not valid JSON"
 * report. It also turned a POST into a GET and then a `405`.
 *
 * An API has no pages to link to, so it answers in its own language: `401` when
 * there is no session, `403` when there is one but it is the wrong role.
 * Both are JSON, so a client can always parse the body and can tell an expired
 * session from a permission problem.
 */
export async function requireApiRole(role: Role) {
  const current = await getCurrentUser();
  if (!current) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } }),
    } as const;
  }
  if (current.user.role !== role) {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } }),
    } as const;
  }
  return { current } as const;
}
