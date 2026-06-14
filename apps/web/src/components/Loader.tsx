export default function Loader({ message = "Loading..." }) {
  return (
    <div
      className="flex-center"
      style={{ flexDirection: "column", gap: "16px", padding: "40px" }}
    >
      <div className="spinner"></div>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
        {message}
      </p>

      <style jsx>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 0, 0, 0.08);
          border-radius: 50%;
          border-top-color: var(--accent-color);
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
