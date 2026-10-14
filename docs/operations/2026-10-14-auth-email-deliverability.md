# Auth e-mail deliverability (confirmation and recovery)

## Symptom

Sign-up confirmation (and password recovery) e-mails do not arrive, or land in spam.

## Root cause

The app calls `supabase.auth.signUp` / `resend` / `resetPasswordForEmail`
(`src/routes/auth.tsx`, `src/components/auth-recovery.tsx`). The repo configured no SMTP
(`supabase/config.toml` held only `project_id`), so Supabase Auth sends through its **built-in
shared mailer**. That sender:

- delivers only to addresses of the Supabase organisation's team members (everyone else is
  rejected silently from the user's point of view);
- is limited to a few messages per hour for the whole project;
- sends from a shared Supabase domain, so SPF/DKIM/DMARC do not align with Nukkia and
  Gmail, Outlook and corporate (private-domain) filters send it to spam or drop it.

Not verified against live logs: the session had no permission to read the project's auth logs.
Confirm in Dashboard → Authentication → Logs after the fix.

## Fix (needs a person with access to DNS and the Supabase dashboard)

1. Pick an SMTP provider (Resend, Postmark, SES, SendGrid). Add a **sending subdomain we own**,
   e.g. `mail.<nukkia-domain>`, and publish the DNS records the provider gives:
   - SPF (TXT) including the provider,
   - DKIM (CNAME/TXT keys),
   - DMARC (TXT on `_dmarc`), start with `p=none; rua=mailto:<inbox>` and tighten to
     `quarantine` once reports are clean,
   - the provider's return-path/bounce record if it asks for one.
   Wait until the provider shows the domain as **verified**.
2. Set the four values from `.env.example` (`AUTH_SMTP_HOST`, `AUTH_SMTP_USER`, `AUTH_SMTP_PASS`,
   `AUTH_SMTP_FROM`; `AUTH_SMTP_FROM` must be an address on the verified domain) in the shell and run
   `supabase config push`. Alternatively enter the same values in Dashboard → Authentication →
   Emails → SMTP Settings. The port in `supabase/config.toml` is 465 (implicit TLS); change it
   if the provider uses 587.
3. Dashboard → Authentication → URL Configuration: set **Site URL** to the production origin and
   add every origin we serve (production, preview, localhost) to **Redirect URLs**, including
   `<origin>/auth`. A redirect outside this list makes Supabase fall back to the Site URL.
4. Raise Authentication → Rate Limits → e-mail sent to match expected sign-up volume.

The templates in `supabase/templates/` are plain, text-forward and carry a copyable link, which
helps spam scoring; they apply with the same `config push`.

## Verify (live, not covered by unit tests)

Sign up with one address each at gmail.com, outlook.com, a private domain and a Google
Workspace domain. For each: the message arrives in the inbox, "Show original" reports
SPF=PASS, DKIM=PASS, DMARC=PASS, and the link signs the user in. Also test "Reenviar
confirmação" and password recovery. Record results here.
