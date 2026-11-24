/**
 * Cookie names, kept in their own module so non-auth code (notably
 * `src/proxy.ts`, which runs in a separate bundle) can read the session cookie
 * without pulling `@/lib/auth` - and through it `next/headers` and the database
 * client - into the Proxy bundle.
 */
export const SESSION_COOKIE = "leou_session";
export const PRELOGIN_COOKIE = "leou_prelogin";
/**
 * Remembers a chess invite a visitor arrived through, so that registering or
 * signing in afterwards returns them to the room they were invited to instead
 * of the dashboard. See `src/lib/chess/invite.ts`.
 */
export const INVITE_COOKIE = "leou_invite";
