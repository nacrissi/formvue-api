import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NOT SET';

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
      maxNetworkRetries: 0,
      timeout: 10000
    });

    // Try a simple API call
    const balance = await stripe.balance.retrieve();

    return res.status(200).json({
      success: true,
      keyPrefix,
      balanceAvailable: balance.available.length > 0
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NOT SET'
    });
  }
}
