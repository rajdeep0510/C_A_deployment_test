"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";

function VerifyEmailSentContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const handleResend = async () => {
    setResendLoading(true);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResendLoading(false);
    setResendDone(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "radial-gradient(circle at 50% 40%, rgba(16,185,129,0.08) 0%, transparent 65%)",
      }}
    >
      <div
        className="glass animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "48px 36px",
          borderRadius: "24px",
          border: "1px solid rgba(16,185,129,0.2)",
          boxShadow: "0 20px 40px rgba(16,185,129,0.05), var(--glass-shadow)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
          }}
        >
          <Mail size={32} style={{ color: "#fff" }} />
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: "800",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: "12px",
          }}
        >
          Check your inbox
        </h1>

        <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "8px" }}>
          We sent a verification link to
        </p>
        {email && (
          <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "24px", wordBreak: "break-all" }}>
            {email}
          </p>
        )}
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "32px" }}>
          Click the link in the email to verify your account. The link expires in 24 hours.
        </p>

        {resendDone ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "#10b981",
              fontSize: "13px",
              background: "rgba(16,185,129,0.08)",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(16,185,129,0.2)",
              marginBottom: "24px",
            }}
          >
            <CheckCircle size={16} />
            Verification email resent!
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendLoading || !email}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "14px",
              fontWeight: "600",
              background: "rgba(16,185,129,0.1)",
              color: "#10b981",
              borderRadius: "12px",
              border: "1px solid rgba(16,185,129,0.3)",
              cursor: resendLoading || !email ? "not-allowed" : "pointer",
              opacity: resendLoading || !email ? 0.6 : 1,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            {resendLoading ? <Loader2 size={16} className="animate-spin" /> : "Resend verification email"}
          </button>
        )}

        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          Already verified?{" "}
          <Link href="/login" style={{ color: "#10b981", fontWeight: "600" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense>
      <VerifyEmailSentContent />
    </Suspense>
  );
}
