"use client";

import en from "@/messages/en.json";
import ro from "@/messages/ro.json";

// Last-resort boundary (the root layout itself failed), so there is no i18n
// provider here: the text comes straight from both translation files.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ro">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
          background: "#fef2f2",
          color: "#450a0a",
        }}
      >
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28 }}>{ro.errors.genericTitle}</h1>
          <p lang="en" style={{ opacity: 0.75 }}>
            {en.errors.genericTitle}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 10,
              border: 0,
              background: "#dc2626",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {ro.common.retry} · <span lang="en">{en.common.retry}</span>
          </button>
        </main>
      </body>
    </html>
  );
}
