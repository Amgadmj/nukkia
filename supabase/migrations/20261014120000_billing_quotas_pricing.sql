-- Billing, tiered quotas, the price registry and the finished-video balance.
-- See docs/superpowers/specs/2026-10-14-billing-quotas-admin-design.md.
-- Additive only. Money-moving tables have no client write grants: every write
-- goes through the service role (API routes, webhook) or a SECURITY DEFINER
-- function that checks ownership itself.

-- ---------------------------------------------------------------------------
-- 1. Pricing assumptions: one row, edited by admins through the API.
-- ---------------------------------------------------------------------------
CREATE TABLE public.pricing_assumptions (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fx_brl_per_usd numeric(8, 4) NOT NULL DEFAULT 5.2 CHECK (fx_brl_per_usd > 0),
  tax_rate numeric(6, 4) NOT NULL DEFAULT 0.06 CHECK (tax_rate >= 0 AND tax_rate < 0.5),
  card_fee_pct numeric(6, 4) NOT NULL DEFAULT 0.0399 CHECK (card_fee_pct >= 0 AND card_fee_pct < 0.2),
  card_fee_fixed_brl numeric(8, 2) NOT NULL DEFAULT 0.39 CHECK (card_fee_fixed_brl >= 0),
  infra_usd_per_company numeric(8, 2) NOT NULL DEFAULT 0.5 CHECK (infra_usd_per_company >= 0),
  usd_per_credit numeric(8, 5) NOT NULL DEFAULT 0.0627 CHECK (usd_per_credit > 0),
  render_credits numeric(8, 2) NOT NULL DEFAULT 68.5 CHECK (render_credits > 0),
  video_yield numeric(5, 2) NOT NULL DEFAULT 2.5 CHECK (video_yield >= 1),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pricing_assumptions (id) VALUES (1);
ALTER TABLE public.pricing_assumptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pricing_assumptions TO authenticated;
GRANT ALL ON public.pricing_assumptions TO service_role;
CREATE POLICY "admins read assumptions" ON public.pricing_assumptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Plan entitlements. The finished videos each plan grants a month; a test
--    keeps this table and src/lib/pricing/catalog.ts in agreement.
-- ---------------------------------------------------------------------------
CREATE TABLE public.plan_entitlements (
  plan_key text PRIMARY KEY CHECK (plan_key IN ('free', 'essencial', 'pro')),
  included_videos integer NOT NULL CHECK (included_videos >= 0)
);
INSERT INTO public.plan_entitlements (plan_key, included_videos)
VALUES ('free', 0), ('essencial', 0), ('pro', 2);
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;
CREATE POLICY "entitlements readable" ON public.plan_entitlements FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Price registry. Immutable once written: a price change is a new row.
--    Customers never read this table; they read public_price_list() below,
--    which hides margins. The CHECK repeats the hard margin floor that
--    src/lib/pricing/economics.ts computed when the row was created.
-- ---------------------------------------------------------------------------
CREATE TABLE public.price_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL CHECK (plan_key IN ('essencial', 'pro')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  cohort_key text NOT NULL CHECK (cohort_key IN ('founding', 'early', 'growth')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  floor_min_cents integer NOT NULL CHECK (floor_min_cents > 0),
  seats integer NOT NULL CHECK (seats > 0),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'retired')),
  worst_margin numeric(6, 4),
  expected_margin numeric(6, 4),
  assumptions jsonb NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT price_registry_above_floor CHECK (amount_cents >= floor_min_cents)
);
CREATE UNIQUE INDEX price_registry_one_published
  ON public.price_registry (plan_key, billing_interval, cohort_key) WHERE status = 'published';
ALTER TABLE public.price_registry ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.price_registry TO authenticated;
GRANT ALL ON public.price_registry TO service_role;
CREATE POLICY "admins read price registry" ON public.price_registry FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.price_registry_freeze()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_key <> OLD.plan_key OR NEW.billing_interval <> OLD.billing_interval
     OR NEW.cohort_key <> OLD.cohort_key OR NEW.amount_cents <> OLD.amount_cents
     OR NEW.floor_min_cents <> OLD.floor_min_cents OR NEW.seats <> OLD.seats
     OR NEW.assumptions <> OLD.assumptions THEN
    RAISE EXCEPTION 'price_registry rows are immutable; publish a new row instead';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER price_registry_freeze_update BEFORE UPDATE ON public.price_registry
FOR EACH ROW EXECUTE FUNCTION public.price_registry_freeze();

-- ---------------------------------------------------------------------------
-- 4. Subscriptions. One live subscription per company; the price is locked
--    to the registry row it was sold at.
-- ---------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  plan_key text NOT NULL CHECK (plan_key IN ('essencial', 'pro')),
  status text NOT NULL CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  price_registry_id uuid REFERENCES public.price_registry (id),
  cohort_key text,
  is_design_partner boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'asaas',
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_one_live_per_company
  ON public.subscriptions (company_id) WHERE status IN ('pending', 'trialing', 'active', 'past_due');
CREATE INDEX subscriptions_status_idx ON public.subscriptions (status, created_at);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
CREATE POLICY "subscriptions by company" ON public.subscriptions FOR SELECT TO authenticated
USING (public.owns_company(company_id));
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. Webhook log, unique per provider event so a retry is a no-op.
-- ---------------------------------------------------------------------------
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error text CHECK (error IS NULL OR char_length(error) <= 500),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_id)
);
CREATE INDEX billing_events_received_idx ON public.billing_events (received_at DESC);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
CREATE POLICY "admins read billing events" ON public.billing_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6. One-off purchases (extra videos).
-- ---------------------------------------------------------------------------
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  sku text NOT NULL CHECK (sku IN ('video_15s', 'film_30s')),
  units integer NOT NULL CHECK (units > 0),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled', 'refunded')),
  provider_payment_id text UNIQUE,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX purchases_company_idx ON public.purchases (company_id, created_at DESC);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
CREATE POLICY "purchases by company" ON public.purchases FOR SELECT TO authenticated
USING (public.owns_company(company_id));

-- ---------------------------------------------------------------------------
-- 7. Finished-video balance: lots (grants with an expiry) and an audit trail.
-- ---------------------------------------------------------------------------
CREATE TABLE public.video_unit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('plan_grant', 'purchase', 'admin')),
  units_granted integer NOT NULL CHECK (units_granted > 0),
  units_remaining integer NOT NULL CHECK (units_remaining >= 0),
  expires_at timestamptz,
  ref text NOT NULL CHECK (char_length(ref) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_unit_lots_remaining_le_granted CHECK (units_remaining <= units_granted),
  UNIQUE (company_id, ref)
);
CREATE INDEX video_unit_lots_open_idx ON public.video_unit_lots (company_id, expires_at)
  WHERE units_remaining > 0;
ALTER TABLE public.video_unit_lots ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.video_unit_lots TO authenticated;
GRANT ALL ON public.video_unit_lots TO service_role;
CREATE POLICY "video lots by company" ON public.video_unit_lots FOR SELECT TO authenticated
USING (public.owns_company(company_id));

CREATE TABLE public.video_unit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.video_unit_lots (id) ON DELETE SET NULL,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('grant', 'consume', 'adjust')),
  ref text NOT NULL CHECK (char_length(ref) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, reason, ref)
);
ALTER TABLE public.video_unit_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.video_unit_events TO authenticated;
GRANT ALL ON public.video_unit_events TO service_role;
CREATE POLICY "video events by company" ON public.video_unit_events FOR SELECT TO authenticated
USING (public.owns_company(company_id));

-- ---------------------------------------------------------------------------
-- 8. Usage ledger gains a standard cost and the plan it was spent under.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_usage
  ADD COLUMN est_cost_usd numeric(10, 4) NOT NULL DEFAULT 0 CHECK (est_cost_usd >= 0),
  ADD COLUMN plan_key text CHECK (plan_key IS NULL OR plan_key IN ('free', 'essencial', 'pro'));
CREATE INDEX ai_usage_created_idx ON public.ai_usage (created_at DESC);

-- ---------------------------------------------------------------------------
-- 9. Functions.
-- ---------------------------------------------------------------------------

-- The plan a company is entitled to right now. A live paid or trial
-- subscription wins; past_due keeps the plan for a 7-day grace period; an
-- expired trial or no subscription is the free plan. Fails closed to free.
CREATE OR REPLACE FUNCTION public.company_plan(_company_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub public.subscriptions;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.owns_company(_company_id) THEN
    RETURN 'free';
  END IF;
  SELECT * INTO _sub FROM public.subscriptions s
  WHERE s.company_id = _company_id AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'free'; END IF;
  IF _sub.status = 'trialing' AND _sub.trial_ends_at IS NOT NULL AND _sub.trial_ends_at < now() THEN
    RETURN 'free';
  END IF;
  IF _sub.status = 'past_due'
     AND COALESCE(_sub.current_period_end, _sub.updated_at) < now() - interval '7 days' THEN
    RETURN 'free';
  END IF;
  RETURN _sub.plan_key;
END; $$;
REVOKE ALL ON FUNCTION public.company_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_plan(uuid) TO authenticated, service_role;

-- Atomic quota check and record, like check_and_record_ai_usage, but it also
-- books the standard cost and the plan. Limits come from the catalog in code.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _company_id uuid, _kind text, _daily_limit integer, _monthly_limit integer,
  _est_cost_usd numeric, _plan_key text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _daily_count integer;
  _monthly_count integer;
BEGIN
  IF NOT public.owns_company(_company_id) THEN RETURN false; END IF;
  IF _daily_limit <= 0 OR _monthly_limit <= 0 THEN RETURN false; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_company_id::text, 0));

  SELECT count(*) INTO _daily_count FROM public.ai_usage
  WHERE company_id = _company_id AND kind = _kind AND created_at > now() - interval '1 day';
  SELECT count(*) INTO _monthly_count FROM public.ai_usage
  WHERE company_id = _company_id AND kind = _kind AND created_at > now() - interval '30 days';
  IF _daily_count >= _daily_limit OR _monthly_count >= _monthly_limit THEN RETURN false; END IF;

  INSERT INTO public.ai_usage (company_id, kind, est_cost_usd, plan_key)
  VALUES (_company_id, _kind, GREATEST(_est_cost_usd, 0), _plan_key);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer, numeric, text)
  TO authenticated, service_role;

-- Seats taken on a registry row: customers who ever started at this price,
-- plus checkouts opened in the last two hours.
CREATE OR REPLACE FUNCTION public.price_seats_taken(_price_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.subscriptions s
  WHERE s.price_registry_id = _price_id
    AND (s.started_at IS NOT NULL OR (s.status = 'pending' AND s.created_at > now() - interval '2 hours'))
$$;
REVOKE ALL ON FUNCTION public.price_seats_taken(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.price_seats_taken(uuid) TO service_role;

-- The public price page: published prices and seats left, no margins.
CREATE OR REPLACE FUNCTION public.public_price_list()
RETURNS TABLE (
  plan_key text, billing_interval text, cohort_key text, amount_cents integer,
  seats integer, seats_taken integer
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.plan_key, p.billing_interval, p.cohort_key, p.amount_cents, p.seats,
         public.price_seats_taken(p.id)
  FROM public.price_registry p WHERE p.status = 'published'
  ORDER BY p.plan_key, p.billing_interval, p.amount_cents
$$;
REVOKE ALL ON FUNCTION public.public_price_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_price_list() TO anon, authenticated, service_role;

-- Reserves a subscription at the cheapest published price with a seat left.
-- Serialized per plan and interval so two checkouts cannot take the last seat.
CREATE OR REPLACE FUNCTION public.reserve_subscription(
  _company_id uuid, _plan_key text, _interval text
) RETURNS public.subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _price public.price_registry;
  _row public.subscriptions;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('reserve:' || _plan_key || ':' || _interval, 0));

  -- An abandoned checkout must not block a new one.
  UPDATE public.subscriptions SET status = 'canceled', canceled_at = now()
  WHERE company_id = _company_id AND status = 'pending';

  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE company_id = _company_id AND status IN ('trialing', 'active', 'past_due')
  ) THEN
    RAISE EXCEPTION 'company already has a live subscription' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.* INTO _price FROM public.price_registry p
  WHERE p.status = 'published' AND p.plan_key = _plan_key AND p.billing_interval = _interval
    AND public.price_seats_taken(p.id) < p.seats
  ORDER BY p.amount_cents ASC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no published price with seats left' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.subscriptions
    (company_id, plan_key, status, billing_interval, amount_cents, price_registry_id, cohort_key)
  VALUES
    (_company_id, _plan_key, 'pending', _interval, _price.amount_cents, _price.id, _price.cohort_key)
  RETURNING * INTO _row;
  RETURN _row;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_subscription(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_subscription(uuid, text, text) TO service_role;

-- Finished-video balance: units in lots that have not expired.
CREATE OR REPLACE FUNCTION public.video_units_balance(_company_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.owns_company(_company_id) THEN RETURN 0; END IF;
  RETURN COALESCE((
    SELECT sum(l.units_remaining)::integer FROM public.video_unit_lots l
    WHERE l.company_id = _company_id AND (l.expires_at IS NULL OR l.expires_at > now())
  ), 0);
END; $$;
REVOKE ALL ON FUNCTION public.video_units_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.video_units_balance(uuid) TO authenticated, service_role;

-- Lazy monthly grant: the first call in each 30-day window of an active or
-- trialing subscription adds the plan's included videos, valid for that
-- window plus one more (one month of rollover, no more).
CREATE OR REPLACE FUNCTION public.ensure_video_grant(_company_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub public.subscriptions;
  _units integer;
  _anchor timestamptz;
  _window integer;
  _lot uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.owns_company(_company_id) THEN RETURN 0; END IF;
  SELECT * INTO _sub FROM public.subscriptions s
  WHERE s.company_id = _company_id AND s.status IN ('trialing', 'active')
  ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF _sub.status = 'trialing' AND _sub.trial_ends_at IS NOT NULL AND _sub.trial_ends_at < now() THEN
    RETURN 0;
  END IF;

  SELECT included_videos INTO _units FROM public.plan_entitlements WHERE plan_key = _sub.plan_key;
  IF COALESCE(_units, 0) <= 0 THEN RETURN 0; END IF;

  _anchor := COALESCE(_sub.started_at, _sub.created_at);
  _window := floor(extract(epoch FROM (now() - _anchor)) / (30 * 86400))::integer;
  IF _window < 0 THEN _window := 0; END IF;

  INSERT INTO public.video_unit_lots (company_id, source, units_granted, units_remaining, expires_at, ref)
  VALUES (_company_id, 'plan_grant', _units, _units,
          _anchor + make_interval(days => 30 * (_window + 2)),
          'grant:' || _sub.id::text || ':' || _window::text)
  ON CONFLICT (company_id, ref) DO NOTHING
  RETURNING id INTO _lot;

  IF _lot IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.video_unit_events (company_id, lot_id, delta, reason, ref)
  VALUES (_company_id, _lot, _units, 'grant', 'grant:' || _sub.id::text || ':' || _window::text)
  ON CONFLICT DO NOTHING;
  RETURN _units;
END; $$;
REVOKE ALL ON FUNCTION public.ensure_video_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_video_grant(uuid) TO authenticated, service_role;

-- Uses one finished video, earliest expiry first. Idempotent per ref, so a
-- poll that sees the same render twice charges once. False means no balance.
CREATE OR REPLACE FUNCTION public.consume_video_unit(_company_id uuid, _ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lot public.video_unit_lots;
BEGIN
  IF NOT public.owns_company(_company_id) THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('video:' || _company_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.video_unit_events
    WHERE company_id = _company_id AND reason = 'consume' AND ref = _ref
  ) THEN
    RETURN true;
  END IF;

  SELECT * INTO _lot FROM public.video_unit_lots l
  WHERE l.company_id = _company_id AND l.units_remaining > 0
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.expires_at ASC NULLS LAST, l.created_at ASC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.video_unit_lots SET units_remaining = units_remaining - 1 WHERE id = _lot.id;
  INSERT INTO public.video_unit_events (company_id, lot_id, delta, reason, ref)
  VALUES (_company_id, _lot.id, -1, 'consume', _ref);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_video_unit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_video_unit(uuid, text) TO authenticated, service_role;

-- Adds a lot. Service role only: purchases, webhook and admin grants.
CREATE OR REPLACE FUNCTION public.grant_video_units(
  _company_id uuid, _units integer, _source text, _ref text, _expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lot uuid;
BEGIN
  IF _units <= 0 THEN RAISE EXCEPTION 'units must be positive'; END IF;
  INSERT INTO public.video_unit_lots (company_id, source, units_granted, units_remaining, expires_at, ref)
  VALUES (_company_id, _source, _units, _units, _expires_at, _ref)
  ON CONFLICT (company_id, ref) DO NOTHING
  RETURNING id INTO _lot;
  IF _lot IS NULL THEN RETURN false; END IF;
  INSERT INTO public.video_unit_events (company_id, lot_id, delta, reason, ref)
  VALUES (_company_id, _lot, _units, 'grant', _ref) ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.grant_video_units(uuid, integer, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_video_units(uuid, integer, text, text, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. Payment events. All subscription and purchase state changes happen here,
--     in one transaction, so the webhook route only authenticates, logs and
--     calls this function. Idempotent: replaying an event changes nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment_event(
  _event text, _payment_id text, _provider_subscription_id text,
  _external_ref text, _paid_at timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub public.subscriptions;
  _purchase public.purchases;
  _purchase_id uuid;
  _when timestamptz := COALESCE(_paid_at, now());
  _paid boolean := _event IN ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED');
BEGIN
  -- One-off purchases carry externalReference 'purchase:<uuid>'.
  IF _external_ref LIKE 'purchase:%' THEN
    BEGIN
      _purchase_id := substr(_external_ref, 10)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN 'ignored';
    END;
    SELECT * INTO _purchase FROM public.purchases WHERE id = _purchase_id FOR UPDATE;
    IF NOT FOUND THEN RETURN 'unknown_purchase'; END IF;

    IF _paid THEN
      IF _purchase.status = 'paid' THEN RETURN 'ignored'; END IF;
      UPDATE public.purchases
      SET status = 'paid', paid_at = _when, provider_payment_id = COALESCE(provider_payment_id, _payment_id)
      WHERE id = _purchase.id;
      PERFORM public.grant_video_units(
        _purchase.company_id, _purchase.units, 'purchase', 'purchase:' || _purchase.id::text,
        _when + interval '365 days');
      RETURN 'purchase_paid';
    ELSIF _event IN ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED') THEN
      IF _purchase.status = 'refunded' THEN RETURN 'ignored'; END IF;
      UPDATE public.purchases SET status = 'refunded' WHERE id = _purchase.id;
      UPDATE public.video_unit_lots SET units_remaining = 0
      WHERE company_id = _purchase.company_id AND ref = 'purchase:' || _purchase.id::text;
      RETURN 'purchase_refunded';
    END IF;
    RETURN 'ignored';
  END IF;

  SELECT * INTO _sub FROM public.subscriptions s
  WHERE (_provider_subscription_id IS NOT NULL AND s.provider_subscription_id = _provider_subscription_id)
     OR (_external_ref IS NOT NULL AND s.id::text = _external_ref)
  ORDER BY s.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_subscription'; END IF;
  IF _sub.status = 'canceled' THEN RETURN 'ignored'; END IF;

  IF _paid THEN
    UPDATE public.subscriptions
    SET status = 'active',
        started_at = COALESCE(started_at, _when),
        current_period_start = _when,
        current_period_end = _when + CASE billing_interval WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END,
        trial_ends_at = NULL
    WHERE id = _sub.id
      AND (current_period_start IS NULL OR current_period_start < _when OR status <> 'active');
    PERFORM public.ensure_video_grant(_sub.company_id);
    RETURN 'activated';
  ELSIF _event = 'PAYMENT_OVERDUE' THEN
    IF _sub.status IN ('active', 'trialing') THEN
      UPDATE public.subscriptions SET status = 'past_due' WHERE id = _sub.id;
      RETURN 'past_due';
    END IF;
    RETURN 'ignored';
  ELSIF _event IN ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED') THEN
    UPDATE public.subscriptions SET status = 'canceled', canceled_at = now() WHERE id = _sub.id;
    RETURN 'canceled';
  END IF;
  RETURN 'ignored';
END; $$;
REVOKE ALL ON FUNCTION public.apply_payment_event(text, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_event(text, text, text, text, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Design partners: a trial of a paid plan, no charge, locked to the
--     cheapest published monthly price (the founding step). Billing starts
--     only if they later check out. Service role only (admin API).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_design_partner(
  _company_id uuid, _plan_key text, _trial_days integer
) RETURNS public.subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _price public.price_registry;
  _row public.subscriptions;
BEGIN
  IF _trial_days < 1 OR _trial_days > 365 THEN RAISE EXCEPTION 'trial must be 1 to 365 days'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('reserve:' || _plan_key || ':month', 0));

  UPDATE public.subscriptions SET status = 'canceled', canceled_at = now()
  WHERE company_id = _company_id AND status = 'pending';
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE company_id = _company_id AND status IN ('trialing', 'active', 'past_due')
  ) THEN
    RAISE EXCEPTION 'company already has a live subscription' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.* INTO _price FROM public.price_registry p
  WHERE p.status = 'published' AND p.plan_key = _plan_key AND p.billing_interval = 'month'
    AND public.price_seats_taken(p.id) < p.seats
  ORDER BY p.amount_cents ASC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no published price with seats left' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.subscriptions
    (company_id, plan_key, status, billing_interval, amount_cents, price_registry_id, cohort_key,
     is_design_partner, started_at, trial_ends_at)
  VALUES
    (_company_id, _plan_key, 'trialing', 'month', _price.amount_cents, _price.id, _price.cohort_key,
     true, now(), now() + make_interval(days => _trial_days))
  RETURNING * INTO _row;
  PERFORM public.ensure_video_grant(_company_id);
  RETURN _row;
END; $$;
REVOKE ALL ON FUNCTION public.grant_design_partner(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_design_partner(uuid, text, integer) TO service_role;
