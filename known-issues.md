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
5. `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 npx convex dev --once --codegen enable --typecheck disable` still entered login flow and failed immediately in non-interactive mode.
6. `npx convex codegen --typecheck disable` no longer prompted for login, but failed because no `CONVEX_DEPLOYMENT` is configured.
7. `CONVEX_DEPLOYMENT=local npx convex codegen --typecheck disable` failed with `401 MissingAccessToken`, confirming access token is still mandatory even for codegen against deployment identifiers.
8. `npx convex login status` now reports `Status: Not logged in` (and references `/home/ubuntu/.convex/config.json`), but no usable authenticated session is present.
9. `npx convex dev --once` still immediately fails in non-interactive mode with the login prompt (`Would you like to login to your account?`).
10. Re-ran `npx convex login status`; still reports `Convex account token found in: /home/ubuntu/.convex/config.json` plus `Status: Not logged in`.
11. Re-ran `npx convex dev --once`; still fails instantly in non-interactive mode with `Cannot prompt for input in non-interactive terminals. (Welcome to Convex! Would you like to login to your account?)`.
12. Inspected CLI docs via `npx convex dev --help && npx convex codegen --help && npx convex login --help`; no non-interactive flag was found for passing an access token directly to `convex dev`.
13. Checked runtime environment for pre-provisioned Convex credentials (`env | rg "^CONVEX"` and repo search for `CONVEX_DEPLOY_KEY`); no Convex auth/deployment env vars are currently configured.
14. Tried `npx convex codegen --dry-run --typecheck disable`; still blocked with `No CONVEX_DEPLOYMENT set`, confirming that even dry-run codegen requires deployment configuration.
15. Reviewed Convex CLI docs for CI/non-interactive auth path; docs indicate `CONVEX_DEPLOY_KEY` is the supported non-interactive credential for CLI commands.
16. Re-checked runtime environment (`env | rg "^CONVEX"`); still no `CONVEX_DEPLOY_KEY` or deployment variables are present.
17. Re-ran `npx convex login status`; CLI still reports `Status: Not logged in` and remains unable to proceed non-interactively.

**Revisit result:** Still unresolved in this environment. Convex CLI setup cannot complete without an interactive token entry mechanism or pre-provisioned machine token/deploy key.
