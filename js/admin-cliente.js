import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";

const urlSupabase = "https://uuravubpjbffxtlgtoyl.supabase.co";
const clavePublica = "sb_publishable_Z-wDoNRjqqeluscPR2E_Jw_1iSkr8Mb";

export const supabase = createClient(urlSupabase, clavePublica, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "reina-admin-auth"
  }
});
