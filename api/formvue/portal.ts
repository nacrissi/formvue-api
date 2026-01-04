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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, returnUrl } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const stripeClient = getStripe();
    const db = getSupabase();

    // Get customer ID from license
    const { data: license } = await db
      .from('formvue_licenses')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    if (!license?.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found for this email' });
    }

    // Create portal session
    const session = await stripeClient.billingPortal.sessions.create({
      customer: license.stripe_customer_id,
      return_url: returnUrl || 'https://formvue.app/account'
    });

    return res.status(200).json({
      url: session.url
    });

  } catch (error: any) {
    console.error('Portal error:', error);
    return res.status(500).json({ error: error.message });
  }
}
