/**
 * Bump this whenever the privacy policy / terms change materially. Sent as
 * signup metadata (see src/routes/auth.tsx) and stored on profiles via the
 * handle_new_user trigger, so we know which version of the policy each
 * account actually agreed to.
 */
export const CONSENT_VERSION = "2026-09-16";
