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
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient()
    });
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, tier, successUrl, cancelUrl } = req.body;

  if (!email || !tier || !['pro', 'team'].includes(tier)) {
    return res.status(400).json({ error: 'Valid email and tier (pro/team) required' });
  }

  try {
    const stripeClient = getStripe();
    const db = getSupabase();

    // Stripe Price IDs
    const PRICE_IDS = {
      pro: process.env.STRIPE_PRICE_PRO || 'price_XXXXX',
      team: process.env.STRIPE_PRICE_TEAM || 'price_XXXXX'
    };

    // Check if customer already exists
    let { data: license } = await db
      .from('formvue_licenses')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    let customerId = license?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email,
        metadata: { source: 'formvue' }
      });
      customerId = customer.id;

      // Save customer ID
      await db
        .from('formvue_licenses')
        .upsert({
          email,
          stripe_customer_id: customerId
        }, {
          onConflict: 'email'
        });
    }

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: PRICE_IDS[tier as 'pro' | 'team'],
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl || 'https://formvue.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://formvue.app/pricing',
      metadata: {
        email,
        tier
      }
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
