import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  return process.env.SUPABASE_URL;
}

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

export function getSupabaseAdmin() {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error("缺少环境变量 SUPABASE_URL");
  }

  const key = getSupabaseKey();
  if (!key) {
    throw new Error("缺少环境变量 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}