"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachRegisterRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/register?tab=coach"); }, [router]);
  return null;
}
