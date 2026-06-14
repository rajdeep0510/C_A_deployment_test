import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: coachId } = await params;
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
    .select("role, academy_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "academy_owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: coachProfile } = await supabaseAdmin
    .from("profiles")
    .select("academy_id")
    .eq("id", coachId)
    .single();

  if (!coachProfile || coachProfile.academy_id !== profile.academy_id) {
    return NextResponse.json({ error: "Coach not in your academy" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(coachId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Coach deleted successfully" });
}
