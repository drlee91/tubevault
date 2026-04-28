"use client";

// Last-resort boundary that catches errors thrown inside the root layout
// itself (e.g. an `ensureBooted()` failure during `app/layout.tsx`). Next.js
// renders this WITHOUT the surrounding layout, so it must define its own
// <html> / <body> and avoid depending on ThemeProvider, fonts, or CSS
// variables that the failing layout would have provided.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          minHeight: "100vh",
          background: "#0a0a0a",
          color: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            TubeVault couldn&apos;t start
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "0.875rem",
              color: "#a3a3a3",
              lineHeight: 1.5,
            }}
          >
            {error.message || "An unexpected error happened during boot."}
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.75rem",
                color: "#737373",
              }}
            >
              digest: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#0a0a0a",
              background: "#f5f5f5",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
