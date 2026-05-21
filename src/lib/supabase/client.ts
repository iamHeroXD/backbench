import { createBrowserClient } from "@supabase/ssr";

// Fallback values prevent the build-time prerendering throw when env vars
// aren't set locally. At runtime on Vercel/real deploys, real values are used.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
