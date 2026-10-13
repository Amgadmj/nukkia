---
name: nukkia-release-checks
description: Verify Nukkia interface or onboarding changes locally and against the exact GitHub commit. Use for Nukkia regression checks, CI qualification and release handoffs; not as permission to deploy or activate providers.
---

# Nukkia release checks

Preserve existing drafts, assets, untracked files and published history. Read AGENTS.md and the nukkia-design skill for interface work. Record the current branch, HEAD and dirty paths before editing. Reuse the existing localhost preview; do not create a competing listener.

## Verification

- Add behavioral regressions for the defect being fixed. For website onboarding, cover bare/www domains, invalid/private targets, no-website → Instagram, request cancellation, source attribution and preserved human edits. A handle is a reference, not proof that Instagram posts were read.
- Run `npm run check` with Node 24. This runs the full regression suite, typecheck, full lint and production build. Do not skip a failing gate or disable rules just to turn CI green. Separate pre-existing failures from introduced defects; report warnings accurately.
- Use the browser to exercise actual submission, back/retry/cancel, reload, keyboard focus and narrow/light/dark states with synthetic data. DOM/render tests do not establish browser behavior, authenticated isolation or screenshot coverage.
- For research, show observed source URLs, retrieved excerpts and actual progress. Keep manual edits intact when delayed responses arrive. Retain HTTPS, DNS/redirect, robots, body-size, time and request limits. Hosted collection requires a validated session and same origin; paid synthesis remains separately gated. Do not replace failed scraping with invented facts.
- Bind evidence to the exact source candidate or commit. Mark each acceptance check implemented-and-verified, implemented-but-unverified or remaining. Treat live cloud, email, storage, provider and account tests as distinct from mocked/unit evidence.

## GitHub

When pushing is authorized, commit only the intended changes and push normally to the feature branch. Verify its remote SHA. Watch the CI run for that exact SHA with `gh run list --branch <branch> --commit <sha>` and `gh run view <run-id>`; inspect failed job logs, fix the responsible defect and rerun. A local pass, queued job, old green run or successful push is not a GitHub CI pass.

Keep credentials out of logs, screenshots and commits. If SSH is unavailable but the existing GitHub CLI login works, an HTTPS push may use `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push <existing-repository-https-url> HEAD:refs/heads/<branch>` without printing tokens. Do not change remotes or rewrite history to work around a rejection.

Stop after the requested change is verified. Hosted deployment, production migrations, real customer mutations and paid/publishing activation require their own authorized scope. Record concrete blockers without presenting them as passed checks.
