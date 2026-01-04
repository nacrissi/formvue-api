import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid module-load crashes
let stripe: Stripe | null = null;
let supabase: SupabaseClient | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing required environment variables');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return supabase;
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

async function buffer(readable: any): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeClient = getStripe();
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
    }

    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const db = getSupabase();
  const email = session.metadata?.email || session.customer_email;
  const tier = session.metadata?.tier || 'pro';

  if (!email) {
    console.error('No email in checkout session');
    return;
  }

  await db
    .from('formvue_licenses')
    .upsert({
      email,
      tier,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      status: 'active',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'email'
    });

  console.log(`Activated ${tier} license for ${email}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const stripeClient = getStripe();
  const db = getSupabase();
  const customerId = subscription.customer as string;

  // Get customer email
  const customer = await stripeClient.customers.retrieve(customerId);
  if (customer.deleted) return;

  const email = customer.email;
  if (!email) return;

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'trialing': 'trialing',
    'unpaid': 'past_due'
  };

  await db
    .from('formvue_licenses')
    .update({
      status: statusMap[subscription.status] || 'active',
      updated_at: new Date().toISOString()
    })
    .eq('email', email);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const stripeClient = getStripe();
  const db = getSupabase();
  const customerId = subscription.customer as string;
  const customer = await stripeClient.customers.retrieve(customerId);
  if (customer.deleted) return;

  const email = customer.email;
  if (!email) return;

  // Downgrade to free tier
  await db
    .from('formvue_licenses')
    .update({
      tier: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  console.log(`Downgraded ${email} to free tier`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripeClient = getStripe();
  const db = getSupabase();
  const customerId = invoice.customer as string;
  const customer = await stripeClient.customers.retrieve(customerId);
  if (customer.deleted) return;

  const email = customer.email;
  if (!email) return;

  await db
    .from('formvue_licenses')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('email', email);
}
