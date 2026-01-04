import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Tier limits for enforcement
const TIER_LIMITS = {
  free: { forms: 1, responses: 100, charts: ['pie', 'bar', 'column'] },
  pro: { forms: -1, responses: -1, charts: 'all' },
  team: { forms: -1, responses: -1, charts: 'all' }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  try {
    // Get or create license record
    let { data: license, error } = await supabase
      .from('formvue_licenses')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code === 'PGRST116') {
      // No record found - create free tier license
      const { data: newLicense, error: insertError } = await supabase
        .from('formvue_licenses')
        .insert({ email, tier: 'free' })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }
      license = newLicense;
    } else if (error) {
      throw error;
    }

    // Calculate limits based on tier
    const tier = license.tier as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[tier];

    // Check if over limits
    const overFormLimit = limits.forms !== -1 && license.usage_forms >= limits.forms;
    const overResponseLimit = limits.responses !== -1 && license.usage_responses >= limits.responses;

    return res.status(200).json({
      email: license.email,
      tier: license.tier,
      status: license.status,
      usage: {
        forms: license.usage_forms,
        dashboards: license.usage_dashboards,
        responses: license.usage_responses
      },
      limits,
      overLimits: {
        forms: overFormLimit,
        responses: overResponseLimit
      },
      canCreateDashboard: !overFormLimit && !overResponseLimit && license.status === 'active'
    });

  } catch (error: any) {
    console.error('License check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
