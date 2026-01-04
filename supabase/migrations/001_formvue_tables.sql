-- FormVue License Management Tables
-- Run this in Supabase SQL Editor for heirloom-licenses project

CREATE TABLE IF NOT EXISTS formvue_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  usage_forms INTEGER DEFAULT 0,
  usage_dashboards INTEGER DEFAULT 0,
  usage_responses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formvue_email ON formvue_licenses(email);
CREATE INDEX IF NOT EXISTS idx_formvue_stripe_customer ON formvue_licenses(stripe_customer_id);

-- Usage events table for tracking
CREATE TABLE IF NOT EXISTS formvue_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('dashboard_created', 'form_connected', 'responses_processed', 'export_pdf', 'share_link')),
  count INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formvue_usage_email ON formvue_usage_events(email);
CREATE INDEX IF NOT EXISTS idx_formvue_usage_created ON formvue_usage_events(created_at);

-- Enable RLS
ALTER TABLE formvue_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE formvue_usage_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API uses service key)
CREATE POLICY "Service role full access to licenses" ON formvue_licenses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to usage" ON formvue_usage_events
  FOR ALL USING (auth.role() = 'service_role');
