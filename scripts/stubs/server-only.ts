/**
 * Stand-in for the `server-only` package, used only when scripts run outside
 * Next.
 *
 * Inside the app, `import "server-only"` is a guard: Next makes it an error to
 * pull a server module into client code. The package is bundled inside Next
 * and cannot be resolved by plain Node, so a script that imports a service
 * would crash on it.
 *
 * The guard is meaningless outside Next — there is no client bundle to leak
 * into — so the tests alias it here to this empty module. This file is never
 * part of the app build; scripts/tsconfig.json is used only by tsx.
 */
export {};
