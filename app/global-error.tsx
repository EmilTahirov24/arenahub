"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="az">
      <body style={{ background: "#0a0b10", color: "#e7e9ee", fontFamily: "sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "1rem",
          }}
        >
          <span style={{ fontSize: "3.5rem" }}>⚠️</span>
          <h1 style={{ marginTop: "1rem", fontSize: "1.5rem", fontWeight: 700 }}>
            Xəta baş verdi · Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", maxWidth: 420, color: "#8b93a7", fontSize: "0.875rem" }}>
            Gözlənilməz bir problem yarandı. Yenidən cəhd edə bilərsiniz.
            <br />
            An unexpected error occurred. You can try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              borderRadius: 6,
              padding: "0.6rem 1.4rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "white",
              background: "linear-gradient(90deg,#7c3aed,#d946ef,#22d3ee)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Yenidən cəhd et · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
