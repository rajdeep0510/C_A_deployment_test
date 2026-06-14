"use client";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.includes("/analysis/")) return null;

  return (
    <footer
      style={{
        marginTop: "auto",
        padding: "24px 48px",
        borderTop: "1px solid var(--glass-border)",
        background: "transparent",
        color: "var(--text-secondary)",
        fontSize: "14px",
        position: "relative",
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>
            Chess Advisor Platform
          </span>{" "}
          © {new Date().getFullYear()}
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          <a
            href="#"
            style={{ transition: "color 0.2s" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Privacy
          </a>
          <a
            href="#"
            style={{ transition: "color 0.2s" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Terms
          </a>
          <a
            href="#"
            style={{ transition: "color 0.2s" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-secondary)")
            }
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
