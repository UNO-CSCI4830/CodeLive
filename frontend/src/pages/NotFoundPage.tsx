import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
        color: "var(--text-primary, #fff)",
        background: "var(--bg-primary, #0a0a0a)",
        fontFamily: "inherit",
      }}
    >
      <h1 style={{ fontSize: "4rem", margin: 0 }}>404</h1>
      <p style={{ fontSize: "1.125rem", opacity: 0.7 }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        style={{
          marginTop: "0.5rem",
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          background: "var(--accent, #6366f1)",
          color: "#fff",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Back to home
      </Link>
    </main>
  );
}
