# Nukkia restructuring through OpenHands and Pixel Agents

Operator request: hand the remaining Nukkia restructuring work to the installed
OpenHands and Pixel Agents workflow. Preserve the approved product direction;
this handoff does not replace the existing implementation.

## Observed readiness on 2026-10-02

- Local OpenHands Canvas: http://127.0.0.1:8000/; Agent Server SDK 1.49.6.
- Pixel Agents 1.4.1: http://127.0.0.1:3101/; use its existing authenticated
  browser session or the URL printed by the running Pixel terminal.
- Existing local bridge: http://127.0.0.1:3102/api/health; connected, zero
  conversations at the readiness observation. Do not start a second bridge.
- Docker Desktop was stopped. It was opened and the daemon reported 29.7.2.
  This proves daemon availability, not a qualified conversation sandbox.
- OpenHands has zero LLM profiles and no configured model credential. The
  default agent's dry-run resolve returns `valid=false` because its `default`
  LLM profile is missing. No worker task has been submitted at this stage. The operator asked to reuse
  the existing Mini/Studio orchestration rather than select a new provider.
- The MacBook hosts the current 8000/3101 bridge. The existing orchestration
  is separate: Mini `100.70.109.115` executes; Studio `100.104.181.62` serves
  models. The September 22 standard-lane receipt records successful worker,
  parent and two isolated child tasks with Qwen3-Coder-Next, followed by fresh
  Qwen3.8-27B review and cleanup. The older four-model qualification plan is
  not evidence that all four roles are enabled.
- Both Macs are online. A fresh pinned-SSH check found the Mini's saved
  `qwen3-coder-next` profile with the Studio endpoint and a stored credential
  (value neither read nor printed). Its Canvas endpoints are unavailable.
- Mini Docker is installed at `/usr/local/bin/docker`, but the daemon is
  unavailable. `open -a Docker` failed with OSLaunchd error 125: no GUI session
  exists for `standard.macmini`; `/dev/console` reports `root` (login screen).
  The operator must sign into that account and open Docker Desktop.
- Studio's LM Studio server responds with HTTP 401 to unauthenticated model
  discovery, including from Mini. This proves reachability and required auth,
  not a loaded coding model. The recorded automation key successfully reaches
  `standard.studio`; no model was loaded or inference requested.
- Hermes is installed on Mini with a `commandcentercontrol` profile, but no
  Hermes process was observed. Its September 24 receipt says the profile and
  board are inert. Do not introduce a competing queue or enable Hermes here.
- No Nukkia source has been deployed to either remote Mac at this stage.

Pixel Agents displays activity; OpenHands executes tasks. Our bridge is local
compatibility code, not upstream OpenHands support in Pixel Agents. A resting
avatar may mean success, error, pause or idle: inspect the OpenHands result.
An empty connected office is not proof of a completed integration.

## Prepared task packet

The current-source worker copy is already prepared at
`/Users/nicolacaprirolo/Developer/nukkia-workers/2026-10-02-T00`.
Its 267 source/design files include the approved uncommitted redesign and
Health prototype. The coordinator-owned manifest is
`/Users/nicolacaprirolo/Developer/nukkia-workers/2026-10-02-T00-source-manifest.json`;
its `aggregate_sha256` binds the exact bytes (sorted relative path + NUL +
file bytes + NUL). Read that identity before staging or dispatch. It stays
outside the worker mount. No Git metadata/history, real env, node_modules,
Lovable state or Supabase cache was copied. This packet is for T00 only.

## Source and product contract

Canonical source: `/Users/nicolacaprirolo/Developer/nukkia`, branch
`codex/nukkia-onboarding`, base HEAD
`5f1a1dab06e003b47614d0597bd8279db2b391c3`.
The current approved redesign and Health prototype include uncommitted and
untracked files. Starting from HEAD alone would omit that work. Workers use a
separate current-source snapshot with a file-hash manifest; the canonical
working directory stays unchanged during a worker task. Do not commit, push,
deploy, rewrite Lovable history or apply remote migrations automatically.

Preserve these requirements:

- Product name **Nukkia**; area **Cérebro**; explanation **cópia digital da marca**.
- Holo-style workspace and editor flow, with Nukkia's own logo, palette and fonts.
- Editable hypotheses separate from confirmed facts. All progress and
  notifications come from actual saved work.
- Existing owner/company persistence, conflict detection, recovery, and
  approval invalidation after edits.
- Brazil and medicine as the first Health scope. Health previews remain
  explicitly fictional until the production gates are implemented and qualified.
- No real patient data, production secrets, paid media generation, automatic
  publication or grants of professional approval in this worker setup.

Read `docs/nukkia-visual-system.md`, the October 2 operations handoffs, and
`docs/plans/2026-10-02-health-studio-v3.md`. The bundled worker design skill
copies the operator-approved Nukkia skill so a Docker worker can read it.
Older README, CONTENT_ENGINE and engineering documents contain superseded
claims; source, tests and dated handoffs must settle conflicts.

## Run in this order

| Task | Outcome | Depends on | Acceptance | First timebox |
| --- | --- | --- | --- | --- |
| T00 | Source-based gap audit and worker qualification | Usable model and verified Docker boundary | One report distinguishes implemented, unverified and missing behavior, references source/tests, includes fresh checks and proposes the smallest next code task | 25 minutes / 30 agent iterations |
| T01 | Fix the highest-priority verified usability or persistence defect | Reviewed T00 evidence; concrete reproduction | One focused change with regression proof; no draft loss; inspect demo/authenticated route, both themes, desktop/narrow layout and reload as applicable | 45 minutes |
| T02 | Complete the first-customer path and confirmed brand context | T00 contract audit, T01 if blocking | Short onboarding → Cérebro → editable draft → review → manual export; edits invalidate approval; owner/company boundaries and recovery tested; reuse existing working path | 60 minutes per bounded slice |
| T03 | Server-owned production prerequisites and input provenance | T00 backend inventory; accountable reviewer/policy decisions for activation | Identity, rights/evidence and confirmed brief are server-authoritative; revoked/unconfirmed inputs cannot release content; reviewed migrations remain unapplied until rollout authorization | 60 minutes per bounded slice |
| T04 | Durable generation jobs and truthful production status | T03 contracts | Idempotency, cost/quota reservations, retries, cancellation and reconciliation tested without paid calls; fictional examples remain distinct from generated media | 60 minutes per bounded slice |
| T05 | Owned avatar and qualified rendering | Selected provider/account, separate face/voice consent, T03–T04 | Provider adapter, consent/revocation and rendering qualification demonstrated; no release based on client flags or an animated worker's approval | 60 minutes per bounded slice |
| T06 | Reviewed delivery, then other content formats | T03–T05 and designated professional reviewers for regulated content | Review binds to the exact immutable version; initial export is manual and authenticated; revoked material cannot be delivered; image/carousel/email slices qualified separately | 60 minutes per bounded slice |
| T07 | Measured pilot, billing and distribution | Working first-customer path and production gates applicable to the pilot | Observed time-to-approved/exported content and actual use; distinguish export from publication; billing/social integrations get separate scopes and tests before activation | Separate tasks after pilot evidence |

T01–T07 are a prioritized sequence, not permission to implement their entire
row in one run. T00 must produce precise file scope and acceptance criteria
before each code slice starts. Existing generic AI/media features may already
cover parts of a row; audit and reuse them. No invented production counts,
claims of legal compliance, beta results or ROI. An avatar provider and
accountable professional reviewers remain undesignated.

## Operator steps

1. Restore the existing execution host: sign into `standard.macmini` on the
   Mini and open Docker Desktop. Verify the daemon before launching anything.
   No desktop user is currently signed in, so SSH alone cannot start Docker.
2. Reuse the accepted standard lane: `scripts/openhands/standard_runtime.py`
   and `security/openhands-standard-release.json` in the command-center source.
   Use the prepared Nukkia current-source snapshot and fresh private Canvas state;
   preserve the older Holi Labs mount and state. Reuse the existing authenticated
   Studio model configuration by credential reference, never copying a secret
   into source, a task file or Pixel. Validate model discovery/tool compatibility
   with `openai/qwen3-coder-next`; do not create a hosted fallback. The standard
   lane accepts the Agent Server holding a dedicated LM Studio token within
   its runtime trust domain. It does not promise credentials are inaccessible
   to every agent sharing that runtime; see the accepted standard-lane guide.
3. Inspect the actual Nukkia container's identity and mounts. Only the current
   snapshot may be writable as project source. No home, SSH, broad cloud
   credential directory or Docker socket may be mounted. Retain installed image
   pins; check availability before any download. Install Linux dependencies
   inside the sandbox using `npm ci`, without copying Mac node_modules. The
   Pixel bridge is currently fixed to local 8000 and SDK 1.49.6; the accepted
   standard lane pins SDK 1.49.1. A remote conversation must not be dispatched
   until the bridge has a separately checked compatible observation route.
4. Start one conversation with the T00 prompt in
   `docs/tasks/2026-10-02-openhands-T00.md`. Set `max_iterations=30`, leave
   auto-title off if submitting via API, and stop at 25 elapsed minutes.
   Do not silently retry or keep dispatching when the model/runtime fails.
5. Watch the OpenHands conversation and its Pixel avatar together. Qualify
   start → working → final response with matching conversation identity and
   actual result. Pixel only gets session/status/tool-label metadata through
   the bridge. Verify a failure or pause stays visible in OpenHands.
6. Review the report, diff and fresh evidence. Convert one confirmed gap into
   an exact task, then run a single implementer in a fresh isolated copy.
   A second reviewer checks the same complete packet, including new files.
   Tests alone do not replace actual browser checks; report unavailable checks.
7. Bring only reviewed changes back to the canonical app, preserving any
   concurrent user edits. Refresh http://127.0.0.1:8082/ and inspect the actual
   affected flow. Re-run relevant checks. Commit/push/deploy remain separate.
8. After the attended Nukkia task succeeds on Mini/Studio, verify restart,
   bounded execution, log rotation and owned shutdown before unattended work.
   Reuse native OpenHands Automation/task ownership where selected; Hermes
   remains inactive. Do not create another scheduler or task ledger. The current
   foreground Pixel bridge is not yet a 24/7 service.

## Evidence and stop rules

For each task retain: exact input manifest, task file, conversation ID, actual
runtime/mount observation, allowed files, resulting diff including new files,
check exit codes, independent review and unresolved limitations. Keep receipt
metadata free of secrets and prompt/completion content. The report itself may
contain the requested product findings, without private customer data.

Checks from the existing app:

```sh
npm run test:onboarding
npm run typecheck
npm run build
npm run lint
```

Capture full lint's current baseline and identify unchanged existing failures;
never claim full lint is clean from a changed-file check. Test new behavior at
its owning layer. Use a focused regression check for an actual defect, rather
than snapshot tests that only repeat implementation text. Later code slices
run relevant scoped lint and `git diff --check` as well.

Pause on missing credentials, incompatible tool calling, unverified sandbox,
source drift, repeated failed checks or the time limit. Report the specific
blocker and saved work. Do not broaden permissions, mount the home directory,
change model providers, pay for rendering, approve medicine or publish to make
an agent appear productive.

## Primary setup references

- [OpenHands installation and model/workspace setup](https://docs.openhands.dev/openhands/usage/agent-canvas/setup)
- [OpenHands current repository](https://github.com/OpenHands/OpenHands)
- [Pixel Agents repository](https://github.com/pixel-agents-hq/pixel-agents)
- [Saved successful standard-lane qualification](../../../holilabs-cortex-worktrees/engineering-command-center-plan-repair/docs/receipts/2026-09-22-standard-openhands-qualification/result.md)
- [Accepted standard-lane operation](../../../holilabs-cortex-worktrees/engineering-command-center-plan-repair/docs/operations/openhands-standard-local.md)
- [Local Pixel compatibility bridge](../../../holilabs-cortex-worktrees/engineering-command-center-plan-repair/docs/operations/openhands-pixel.md).

The archived `OpenHands/agent-canvas` repository points to `OpenHands/OpenHands`.
Retain the installed compatibility versions for this qualification; upgrades
are a separate change, not a prerequisite to starting T00.
