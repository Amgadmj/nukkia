# Billing, tiered quotas, price registry, video meter and admin panel

Status: implemented on `feat/billing-quotas-admin`. Source of the numbers: the Nukkia pricing plan v1
(14 Oct 2026). Tax rate 6% is confirmed by the founders; the card fee (3.99% + R$0.39) is an estimate.

## Goals

1. Replace the single global AI limits with per-plan quotas (`free`, `essencial`, `pro`).
2. Charge for plans and extra videos through Asaas (Pix, card), with signed webhooks and idempotent processing.
3. Keep every published price above a deterministic margin floor, enforced in code and in the database.
4. Show customers how many finished videos they have left.
5. Give the founders an admin panel to inspect all data and the business metrics.

## Principles

- **Prices are public and identical per cohort.** The registry holds one row per plan, interval and cohort
  (founding 1-10, 11-25, 26-50). Checkout picks the cheapest row with seats left. There is no per-user price.
- **The floor lives in code.** `economics.checkPrice` blocks a price whose worst-case gross margin is below 40%
  and flags one below the 55% alarm or the 60% target. The database repeats the hard floor as a CHECK on
  `price_registry.amount_cents >= floor_min_cents`, and no client role can write the table.
- **Customers see videos, not credits.** One unit is one finished 15-second video. A render that fails
  costs the customer nothing; a technical cap of renders per period bounds our cost.
- **Standard costing.** Each metered action records an estimated dollar cost in `ai_usage.est_cost_usd`
  from the catalog. Real provider invoices replace the estimate later without changing the schema.
- **Admin reads use the signed-in user's client.** RLS lets admins read; writes that change money
  (prices, assumptions, grants, plan overrides) go through `/api/admin/*` after a server-side `has_role` check.

## Data model (migration `20261014120000_billing_quotas_pricing.sql`)

| Table                                     | Purpose                                                                | Who writes                       |
| ----------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `pricing_assumptions`                     | One row: FX, tax, card fee, credit price, render credits, yield, infra | service role                     |
| `price_registry`                          | Versioned public prices with seats, floor snapshot                     | service role                     |
| `subscriptions`                           | One live subscription per company, locked price, Asaas ids             | service role                     |
| `billing_events`                          | Raw webhook log, unique `(provider, event_id)`                         | service role                     |
| `purchases`                               | One-off purchases such as extra videos                                 | service role                     |
| `video_unit_lots` / `video_unit_events`   | Finished-video balance, grants, consumption, expiry                    | service role + definer functions |
| `ai_usage` (+ `est_cost_usd`, `plan_key`) | Quota counter and standard cost                                        | definer function                 |

## Flows

- **Quota:** route calls `checkAiQuota` -> plan lookup (`company_plan`) -> catalog limits -> `consume_ai_quota`
  (advisory lock, rolling 24 h and 30 d windows, records the estimated cost).
- **Checkout:** `POST /api/billing/checkout` -> price row with seats -> Asaas customer and subscription ->
  pending `subscriptions` row -> first invoice URL back to the browser.
- **Webhook:** `POST /api/billing/webhook` -> constant-time token check -> insert into `billing_events`
  (duplicate = already handled) -> state transition -> 200.
- **Video meter:** `ensure_video_grant` (lazy monthly grant), `video_units_balance`, `consume_video_unit`
  when a render becomes `ready`; `startVideoRender` is refused at zero balance.

## Out of scope

Dunning emails, proration on plan change, tax invoices (NFS-e), multi-currency, per-seat pricing,
and replacing estimated costs with provider invoices.
