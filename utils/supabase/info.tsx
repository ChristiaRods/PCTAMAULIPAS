const env = import.meta.env as Record<string, string | undefined>;

export const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim() || "";
export const publicAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || "";
export const functionName = env.VITE_SUPABASE_FUNCTION_NAME?.trim() || "server";

export const hasSupabaseEnvConfig =
  Boolean(projectId) && Boolean(publicAnonKey);
