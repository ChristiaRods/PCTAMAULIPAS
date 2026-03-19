const env = import.meta.env as Record<string, string | undefined>;

const FALLBACK_PROJECT_ID = "eatywizrhrsingauqdfh";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdHl3aXpyaHJzaW5nYXVxZGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTY3NzQsImV4cCI6MjA4NTI3Mjc3NH0.zjB1yJ5Mpn1KvxXvVnTZUXft5eXjDWDQlsy8YrE4ABk";

export const projectId = env.VITE_SUPABASE_PROJECT_ID || FALLBACK_PROJECT_ID;
export const publicAnonKey = env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
export const functionName = env.VITE_SUPABASE_FUNCTION_NAME || "make-server-aac1ff1a";

export const hasSupabaseEnvConfig =
  Boolean(env.VITE_SUPABASE_PROJECT_ID) && Boolean(env.VITE_SUPABASE_ANON_KEY);
