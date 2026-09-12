import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jvllzbqscczamhrviuun.supabase.co";
const supabasePublishableKey = "sb_publishable_jrtDAUpXgt6aoMYycyuhxA_1MYDngN4";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
