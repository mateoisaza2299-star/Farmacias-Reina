import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";

const url = "https://uuravubpjbffxtlgtoyl.supabase.co";
const key = "sb_publishable_Z-wDoNRjqqeluscPR2E_Jw_1iSkr8Mb";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
