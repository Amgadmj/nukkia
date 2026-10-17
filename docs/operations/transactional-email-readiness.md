# Transactional email activation

Status: not activated or delivery-verified. Repository inspection does not establish the live Supabase project's SMTP configuration. The app delegates confirmation, recovery and resend email to Supabase Auth; changing frontend code alone cannot repair provider delivery.

Official setup and troubleshooting: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw

## Inputs needed from the operator

- An existing dedicated SMTP provider/account (SES, Resend or another SMTP-compatible provider).
- A verified sender domain/address and DNS access for the provider's SPF/DKIM records and the domain's DMARC policy.
- SMTP host, TLS port, username and password, entered only into Supabase Auth's protected SMTP settings, never frontend VITE variables, chat or version control.
- Production Site URL and an explicit redirect allowlist matching the app's actual authentication callback and recovery flow.

## Activation checklist

1. Confirm the domain and sender identity at the selected provider. For SES, verify regional credentials and any sandbox recipient restrictions before production use.
2. Configure custom SMTP in the target Supabase project's Authentication settings. Do not create a competing frontend mail transport or disable confirmation to mask failures.
3. Review confirmation/reset/resend templates and callback URLs. Disable provider link rewriting if it changes authentication tokens or destinations.
4. Test confirmation, resend and password recovery separately with operator-approved test addresses. Record Supabase event, provider message id, accepted/delivered/bounce state and actual inbox arrival. Never log tokens or email bodies.
5. Verify expired/reused links and recovery preserve the intended destination. Check suppression/bounce logs and rate limits without repeated blind resends.
6. Mark delivery qualified only after inbox receipt and successful callback, not merely a frontend success message or provider acceptance.

## Boundaries

No accounts, subscriptions, DNS records, live Auth configuration, email sends or credential changes were performed for this feedback implementation. Activation is blocked on the inputs above, not on a missing UI button. Rollback is restoration of the prior protected SMTP/Auth settings by the operator; never remove DNS records blindly.
