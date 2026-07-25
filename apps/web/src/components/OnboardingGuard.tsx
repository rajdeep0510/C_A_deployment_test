"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Paths that don't require a completed profile.
const ALLOWED_UNONBOARDED = [
  "/account-setup",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/verify-email",
];

function isAllowed(pathname: string) {
  return ALLOWED_UNONBOARDED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (isAllowed(pathname)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (!data.onboarded) {
          router.replace("/account-setup");
        }
      } catch {
        // ignore; anonymous users hit /api/auth/me and get 401, which is fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
