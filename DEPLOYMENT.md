# Deployment Checklist

Use this checklist when shipping changes to production.

## 1. Verify Local Changes

Check the working tree and review the diff:

```bash
git status --short --branch
git diff --staged
git diff
```

Run focused tests for the files you changed. For AI model config changes:

```bash
npm test -- lib/ai/models.test.ts
```

For broader changes, run:

```bash
npm run lint
npm run typecheck
npm test
```

## 2. Commit Changes

Stage the relevant files and commit:

```bash
git add <files>
git commit -m "$(cat <<'EOF'
feat: describe the production change

EOF
)"
```

Confirm the branch is ahead of origin:

```bash
git status --short --branch
```

## 3. Push To GitHub

Push the current branch:

```bash
git push origin main
```

Confirm the branch is synced:

```bash
git status --short --branch
git rev-parse HEAD
```

## 4. Deploy Convex Production

Deploy Convex whenever backend code, schema, HTTP actions, or environment-dependent behavior changes:

```bash
npx convex deploy -y
```

The deploy should finish with:

```text
Deployed Convex functions
```

Required AI provider keys live in Convex, not Vercel:

```bash
npx convex env set OPENAI_API_KEY <your-key> --prod
npx convex env set ANTHROPIC_API_KEY <your-key> --prod
npx convex env set GEMINI_API_KEY <your-key> --prod
```

## 5. Confirm Vercel Deployment

Check GitHub deployment records for a Production deployment matching the pushed commit:

```bash
gh api 'repos/matt-bornstein/cleo/deployments?per_page=10' \
  --jq '.[] | {id, sha, environment, created_at, updated_at}'
```

Then check the latest deployment status:

```bash
gh api 'repos/matt-bornstein/cleo/deployments/<deployment-id>/statuses' \
  --jq '.[] | {state, environment, target_url, description}'
```

Expected result:

```text
state: success
environment: Production
```

If Vercel did not auto-deploy, deploy manually:

```bash
vercel --prod --yes
```

If the Vercel CLI token is invalid, run:

```bash
vercel login
```

Then retry the production deploy.

## 6. Update The Public Alias

After confirming the latest deployment is ready, point `cleo-editor.vercel.app` at it:

```bash
vercel alias set <latest-deployment>.vercel.app cleo-editor.vercel.app
```

Example:

```bash
vercel alias set cleo-l32u5tf77-mattbornsteins-projects.vercel.app cleo-editor.vercel.app
```

## 7. Verify Aliases

Inspect the latest deployment:

```bash
vercel inspect <latest-deployment>.vercel.app
```

Confirm `cleo-editor.vercel.app` appears in the alias list:

```bash
vercel alias ls
```

## 8. Final Smoke Check

Open the public app:

```text
https://cleo-editor.vercel.app
```

Confirm the shipped feature is visible and basic app flows still work.
