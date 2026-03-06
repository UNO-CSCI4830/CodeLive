import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run 'infisical run -- npm run dev' or check your Infisical project."
  );
}

/**
 * Admin-level Supabase client (uses the service_role key).
 *
 * ⚠️  This client bypasses RLS — only use it in trusted server-side code.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
