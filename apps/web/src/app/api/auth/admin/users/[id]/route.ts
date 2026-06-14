import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteAcademyCascade } from "@/lib/auth-utils";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .single();

  if (targetProfile?.role === "academy_owner") {
    const { data: academies } = await supabaseAdmin
      .from("academies")
      .select("id")
      .eq("owner_id", targetId);

    if (academies) {
      for (const academy of academies) {
        await deleteAcademyCascade(academy.id);
      }
    }
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "User deleted successfully" });
}
