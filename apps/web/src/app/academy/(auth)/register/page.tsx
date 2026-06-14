"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AcademyRegisterRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/register?tab=academy"); }, [router]);
  return null;
}
