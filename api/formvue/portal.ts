import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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
    // Get customer ID from license
    const { data: license } = await supabase
      .from('formvue_licenses')
      .select('stripe_customer_id')
      .eq('email', email)
      .single();

    if (!license?.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found for this email' });
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
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
