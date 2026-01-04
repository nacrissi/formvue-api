import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const key = process.env.STRIPE_SECRET_KEY!;

    // Direct fetch to Stripe API
    const response = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const data = await response.json();

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      keyPrefix: key.substring(0, 10),
      data
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      name: error.name
    });
  }
}
