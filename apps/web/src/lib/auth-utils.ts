import { supabaseAdmin } from "./supabase-admin";

export async function deleteAcademyCascade(academyId: string) {
  // Find all coaches with this academy_id
  const { data: coaches } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("academy_id", academyId);

  if (coaches) {
    for (const coach of coaches) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(coach.id);
      } catch (e) {
        // skip if already deleted or error
      }
    }
  }

  // Get the academy owner
  const { data: academy } = await supabaseAdmin
    .from("academies")
    .select("owner_id")
    .eq("id", academyId)
    .single();

  const ownerId = academy?.owner_id;

  // Delete the academy itself
  await supabaseAdmin.from("academies").delete().eq("id", academyId);

  if (ownerId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(ownerId);
    } catch (e) {
      // skip
    }
  }
}
