import { useState, FormEvent } from "react";
import "../styles/AuthForm.css";

export interface AuthCredentials {
  name?: string;
  email: string;
  password: string;
}

interface AuthFormProps {
  mode: "login" | "signup";
  onSubmit: (credentials: AuthCredentials) => Promise<void>;
  error: string | null;
  busy: boolean;
}

export default function AuthForm({ mode, onSubmit, error, busy }: AuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      email,
      password,
      ...(mode === "signup" ? { name } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {error && <p className="auth-form-error">{error}</p>}

      {mode === "signup" && (
        <div>
          <label htmlFor={`${mode}-name`} className="auth-form-label">
            Name
          </label>
          <input
            id={`${mode}-name`}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-form-input"
            placeholder="Your name"
            autoComplete="name"
            disabled={busy}
          />
        </div>
      )}

      <div>
        <label htmlFor={`${mode}-email`} className="auth-form-label">
          Email
        </label>
        <input
          id={`${mode}-email`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-form-input"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={busy}
        />
      </div>

      <div>
        <label htmlFor={`${mode}-password`} className="auth-form-label">
          Password
        </label>
        <input
          id={`${mode}-password`}
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-form-input"
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          disabled={busy}
        />
      </div>

      <button type="submit" className="auth-form-submit" disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </button>
    </form>
  );
}
