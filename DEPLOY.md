# FormVue API Deployment Guide

## Prerequisites
- [x] Vercel CLI installed
- [x] Supabase CLI installed
- [x] Stripe account configured
- [x] Node.js 18+

## Step 1: Run Supabase Migration

Execute this SQL in your Supabase dashboard (SQL Editor):
- Project: `heirloom-licenses`
- URL: https://supabase.com/dashboard/project/sfezkbutdifnrldbkfwk/sql

```sql
-- Copy contents of supabase/migrations/001_formvue_tables.sql
-- Or run from CLI if linked:
-- supabase db push
```

## Step 2: Create Environment Variables

Create `.env` file in this directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in:
- `SUPABASE_URL` - Already set: `https://sfezkbutdifnrldbkfwk.supabase.co`
- `SUPABASE_SERVICE_KEY` - Get from Supabase Dashboard > Settings > API > service_role key
- `STRIPE_SECRET_KEY` - From Stripe Dashboard > Developers > API keys
- `STRIPE_WEBHOOK_SECRET` - Create webhook endpoint first (Step 4)
- `STRIPE_PRICE_PRO` - `price_1SlyJnJ9xEvnYt8O88aKvjX3`
- `STRIPE_PRICE_TEAM` - `price_1SlyJvJ9xEvnYt8OyxGNqALl`

## Step 3: Deploy to Vercel

```bash
cd /Users/matronanigma/projects/formvue-api
vercel --prod
```

Note the deployed URL (e.g., `https://formvue-api.vercel.app`)

## Step 4: Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://formvue-api.vercel.app/api/formvue/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
5. Redeploy: `vercel --prod`

## Step 5: Update Apps Script

Update `LicenseManager.js` API_BASE if different:
```javascript
var API_BASE = 'https://formvue-api.vercel.app/api/formvue';
```

## Step 6: Deploy Apps Script

```bash
cd /Users/matronanigma/projects/formvue
clasp push
clasp deploy --description "FormVue v1.0.0"
```

## Verification Checklist

- [ ] Supabase tables created (`formvue_licenses`, `formvue_usage_events`)
- [ ] Vercel API deployed and responding
- [ ] Stripe webhook configured
- [ ] Apps Script deployed
- [ ] License check working (test with free account)
- [ ] Upgrade flow working (test Stripe checkout)

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/formvue/license` | GET | Check user license by email |
| `/api/formvue/usage` | POST | Log usage event |
| `/api/formvue/checkout` | POST | Create Stripe checkout session |
| `/api/formvue/webhook` | POST | Handle Stripe webhooks |
| `/api/formvue/portal` | POST | Create Stripe customer portal session |
