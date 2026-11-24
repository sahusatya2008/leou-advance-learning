<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local run / environment

- The app speaks on `127.0.0.1:3001` from a **production Docker build** (`leou-app`, image `leou-platform:local`, `NODE_ENV=production`), not from `next dev`. Source edits are not picked up until the image is rebuilt: `docker compose up -d --build app`. The Postgres DB is `leou-db` (host port `5433`), and the public URL is served through a Tailscale Funnel LaunchAgent (`com.leou.funnel`) → `127.0.0.1:3001` as `https://leou.tailabe1e6.ts.net`. `tailscaled` itself is kept up by `brew services`. Tailscale is the open-source Homebrew formula (not the cask) because Funnel on macOS requires the open-source variant.
- Plain `tsx` scripts do **not** load `.env`; the `DATABASE_URL` that Prisma's pg adapter reads must be injected. Scripts therefore start with `import "dotenv/config"` (see `scripts/`). Scratch DB probes belong inside `scripts/` with that import too — running from `/tmp` cannot resolve `dotenv` or the `@/` path alias.

## Always-on engine (Mac-only, `~/.config/leou/`)

The platform is babysat by five launchd agents (`launchctl list | grep com.leou`):

- `com.leou.watchdog` — every 30s runs `leou-engine.sh`: keeps Docker Desktop, `leou-db` and the app container up, restarts the app container after 3 consecutive failed local `/api/health` checks (and the DB too at 6), and repairs the public Funnel when the real ingress path fails (see the `com.leou.funnel` entry below). Holds a single-instance lock and defers to a deploy in flight via the `state/deploy` marker.
- `com.leou.selfdeploy` — every 120s runs `selfdeploy.sh`: fingerprints the working tree (`src prisma public` + Dockerfile/compose/package.json/next/tsconfig/.env; a change must hold across two passes), then builds the app image (old container keeps serving), applies `docker migrate` only when `prisma/` changed, recreates and waits for `/api/health`. Failed trees are cooled down for 10 min instead of hammering the build.
- `com.leou.funnel` — asserts the Tailscale Funnel on load: `tailscale funnel --bg 3001` → public `https://leou.tailabe1e6.ts.net`. RunAtLoad-only (no KeepAlive — `--bg` makes tailscaled keep serving). The watchdog probes the public path against the **Funnel ingress IP** (never via MagicDNS: the ts.net name resolves to this machine's own tailnet IP, so a plain curl hairpins and returns 200 even when outside visitors get a closed connection). On failure it escalates at 2 misses to re-assert and at 4 to a full `funnel --https=443 off` → `--bg 3001` reset, which is what actually re-registers a wedged Funnel.
- `com.leou.awake` — `caffeinate -dimsu` so the Mac never idle-sleeps the site off.
- `com.leou.backup` — nightly DB dump at 03:17.

Useful facts:
- Status: `bash ~/.config/leou/status.sh` (containers, local + public health, engine counters, last deployed HEAD).
- A real rebuild takes ~5–16 min (2.5GB face layer export is slow); the old container keeps serving until the swap.
- `face/` (2.5GB of model weights) is **excluded** from the fingerprint; face code/model changes are a manual `docker compose up -d --build app`.
- Container names may be hash-prefixed (e.g. `2a4276cd665d_leou-app`); the engine resolves them by `com.docker.compose` labels, not hardcoded names.
- Pause auto-deploy: `launchctl bootout gui/$(id -u)/com.leou.selfdeploy`.
- **Never let an "app vault" hide Docker.** On 2026-10-29 the user's `SNSX Vault.app` (`~/Documents/protectfolder`) moved `/Applications/Docker.app` into its hidden store and left a Face-ID gate stub behind. With no docker CLI the daemon was gone, nothing listened on `:3001`, and the public Funnel answered **502** for ~17h. The engine now detects a stub/missing `/Applications/Docker.app`, alerts via notification, and (if `~/.local/leou/Docker.app` exists) restores from that copy; otherwise it opens the vault gate and logs `docker.fail`. `status.sh` prints `docker bundle : OK|BROKEN`. Exclude Docker (and any Docker Desktop helper) from any vault/hider app.
- **Honest ceiling:** this is a Mac-only host. A powered-off Mac (or dead battery) takes the site down no matter what these agents do; they only guarantee recovery within ~30–60s whenever the Mac is on.
