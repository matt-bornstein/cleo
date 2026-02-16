# Known Issues

## 2026-02-16 — Convex CLI non-interactive login/setup blocker

- **Context:** Phase 1 foundation setup requires configuring a Convex deployment and generating `_generated` files.
- **Attempts made:**
  1. `npx convex dev --once` → failed; CLI requested interactive login.
  2. `npx convex dev --once --configure new --dev-deployment local` → failed; still requests interactive login.
  3. `npx convex init --help` checked for non-interactive flags; none found for bypassing login prompt.
- **Observed error:** `Cannot prompt for input in non-interactive terminals. (Welcome to Convex! Would you like to login to your account?)`
- **Impact:** Cannot perform real Convex deployment bootstrap/codegen from this terminal session yet.
- **Current workaround:** Continue implementing app and Convex function/schema source files; defer actual deployment/codegen until a non-interactive auth path is available.
- **Suggested next step:** Retry with pre-provisioned Convex auth environment variables or project configuration if available.

### Revisit attempts after implementing all phases

1. `npx convex login --help` + `npx convex login status` to discover non-interactive capabilities and current auth state.
2. `npx convex login --login-flow paste --no-open` failed due device-name prompt in non-interactive terminal.
3. `npx convex login --login-flow paste --no-open --device-name cursorvm` failed due token paste prompt in non-interactive terminal.
4. `CONVEX_DEPLOYMENT=local npx convex dev --once` still entered login flow and failed on non-interactive device-name prompt.

**Revisit result:** Still unresolved in this environment. Convex CLI setup cannot complete without an interactive token entry mechanism or pre-provisioned machine token.
