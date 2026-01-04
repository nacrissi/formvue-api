import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Try to query the formvue_licenses table
    const { data, error } = await supabase
      .from('formvue_licenses')
      .select('count')
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        hint: error.hint,
        code: error.code
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase connection works!',
      data
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
