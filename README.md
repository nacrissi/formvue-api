# FormVue API

Serverless API for FormVue license management, usage tracking, and Stripe integration.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/formvue/license` | GET | Check license status by email |
| `/api/formvue/usage` | POST | Log usage events |
| `/api/formvue/checkout` | POST | Create Stripe checkout session |
| `/api/formvue/webhook` | POST | Stripe webhook handler |
| `/api/formvue/portal` | POST | Create Stripe customer portal session |

## Setup

### 1. Run Supabase Migration
Execute `supabase/migrations/001_formvue_tables.sql` in your Supabase SQL editor.

### 2. Create Stripe Products
```bash
# Pro tier ($9.99/mo)
stripe products create --name "FormVue Pro" --description "Unlimited forms, all charts, auto-refresh, PDF export"
stripe prices create --product [PRODUCT_ID] --unit-amount 999 --currency usd -d "recurring[interval]=month"

# Team tier ($24.99/mo)
stripe products create --name "FormVue Team" --description "Shared dashboards, multiple users, priority support"
stripe prices create --product [PRODUCT_ID] --unit-amount 2499 --currency usd -d "recurring[interval]=month"
```

### 3. Set Vercel Environment Variables
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add STRIPE_PRICE_PRO
vercel env add STRIPE_PRICE_TEAM
```

### 4. Deploy
```bash
npm install
vercel --prod
```

### 5. Configure Stripe Webhook
Point Stripe webhook to `https://your-domain.vercel.app/api/formvue/webhook`

Events to listen for:
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed

## API Usage

### Check License
```javascript
const response = await fetch('https://api.formvue.app/api/formvue/license?email=user@example.com');
const license = await response.json();
// { tier: 'free', canCreateDashboard: true, limits: {...} }
```

### Track Usage
```javascript
await fetch('https://api.formvue.app/api/formvue/usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    event: 'dashboard_created',
    count: 1
  })
});
```

### Create Checkout
```javascript
const { url } = await fetch('https://api.formvue.app/api/formvue/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    tier: 'pro'
  })
}).then(r => r.json());

window.open(url, '_blank');
```
