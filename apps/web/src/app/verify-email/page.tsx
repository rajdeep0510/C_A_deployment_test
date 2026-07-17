"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    error ? "error" : token ? "loading" : "error"
  );

  useEffect(() => {
    if (!token || error) return;

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        // The API redirects — if we land here it means no redirect happened
        // The API returns a redirect to /login?verified=1 on success
        // or /verify-email?error=expired on failure
        // Since we're on this page, the redirect was followed by the browser
        // We just need to handle the ?error param which is already done above
      })
      .catch(() => setStatus("error"));

    // Give the redirect a moment to happen
    const timeout = setTimeout(() => {
      router.push("/login?verified=1");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [token, error, router]);

  const isExpired = error === "expired" || error === "missing";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: status === "error"
          ? "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.06) 0%, transparent 65%)"
          : "radial-gradient(circle at 50% 40%, rgba(16,185,129,0.08) 0%, transparent 65%)",
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "48px 36px",
          borderRadius: "24px",
          border: status === "error"
            ? "1px solid rgba(239,68,68,0.2)"
            : "1px solid rgba(16,185,129,0.2)",
          boxShadow: "var(--glass-shadow)",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
              }}
            >
              <Loader2 size={28} style={{ color: "#fff" }} className="animate-spin" />
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: "800", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "12px" }}>
              Verifying your email…
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              Redirecting you to login in a moment.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                boxShadow: "0 8px 24px rgba(239,68,68,0.3)",
              }}
            >
              <XCircle size={28} style={{ color: "#fff" }} />
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: "800", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "12px" }}>
              {isExpired ? "Link expired" : "Invalid link"}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
              {isExpired
                ? "This verification link has expired or already been used. Request a new one from the login page."
                : "This verification link is invalid. Please try registering again."}
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                fontSize: "14px",
                fontWeight: "600",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff",
                borderRadius: "12px",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(99,102,241,0.25)",
              }}
            >
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
