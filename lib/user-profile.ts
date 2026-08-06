import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Ensures password, OAuth, and magic-link users all have an HR profile row. */
export async function ensureUserProfile(user: User) {
  const supabase = createClient();
  const { error } = await supabase.from("users").upsert({ id: user.id, email: user.email || "", full_name: user.user_metadata.full_name || null });
  if (error) throw new Error(`Could not initialize user profile: ${error.message}`);
}
