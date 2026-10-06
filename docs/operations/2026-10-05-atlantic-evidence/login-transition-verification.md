# Login transition follow-up — 5 October 2026

User correction: label below the official symbol is Nukkia. New profiles see the existing centered large symbol dock above profile questions. Configured accounts see centered branding while account/workspace data load, then dashboard; they never briefly render profile questions.

Implementation: shared BrandLoading at authenticated pending, provider-loading and account-loading boundaries; returning accounts hold the logo for 650ms after readiness (0ms for reduced motion). Conflict/error handling remains visible; logout, identity change, unmount and sync changes revoke delayed navigation. Explicit setup replay remains available.

Scope identity: login-transition-source.json binds the seven-file delta on codex/nukkia-onboarding, base 5f1a1dab06e003b47614d0597bd8279db2b391c3. Earlier screenshots/manifests remain historical and are not rebound.

Verification: 588 tests pass, typecheck/build pass, scoped lint passes. Added regressions exercise return-account loading/no question flash, delayed dashboard routing, cancellation on logout/account change/conflict and explicit replay. Local new-profile page observed on desktop and 390px with Nukkia under symbol. Screenshot: nukkia-profile-brand.jpg. Live authenticated login and remote account persistence were not exercised: no identified signed-in test session was available. No provider activation, remote account changes, migrations, deployment or new preview server.
