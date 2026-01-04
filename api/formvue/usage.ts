import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

type EventType = 'dashboard_created' | 'form_connected' | 'responses_processed' | 'export_pdf' | 'share_link';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, event, count = 1, metadata } = req.body;

  if (!email || !event) {
    return res.status(400).json({ error: 'Email and event required' });
  }

  try {
    // Log the usage event
    const { error: eventError } = await supabase
      .from('formvue_usage_events')
      .insert({
        email,
        event_type: event as EventType,
        count,
        metadata
      });

    if (eventError) throw eventError;

    // Update aggregate counts on license record
    const updateField = getUpdateField(event as EventType);
    if (updateField) {
      const { error: updateError } = await supabase.rpc('increment_usage', {
        user_email: email,
        field_name: updateField,
        increment_by: count
      });

      // If RPC doesn't exist, do manual update
      if (updateError) {
        const { data: license } = await supabase
          .from('formvue_licenses')
          .select(updateField)
          .eq('email', email)
          .single();

        if (license && typeof license === 'object') {
          const licenseRecord = license as unknown as Record<string, number>;
          const currentValue = licenseRecord[updateField] || 0;
          await supabase
            .from('formvue_licenses')
            .update({
              [updateField]: currentValue + count,
              updated_at: new Date().toISOString()
            })
            .eq('email', email);
        }
      }
    }

    return res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Usage tracking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getUpdateField(event: EventType): string | null {
  switch (event) {
    case 'dashboard_created':
      return 'usage_dashboards';
    case 'form_connected':
      return 'usage_forms';
    case 'responses_processed':
      return 'usage_responses';
    default:
      return null;
  }
}
