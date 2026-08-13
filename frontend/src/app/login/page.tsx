"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi, ApiError } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";


export default function LoginPage() {


  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const em = email.toLowerCase().trim();
    if (!em.endsWith("@talakunchi.com") && !em.endsWith("@talakunchi.in")) {
      setError("Please use your @talakunchi.com or @talakunchi.in company email.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { url } = await authApi.getGoogleOAuthUrl();
      window.location.href = url;
    } catch {
      setError("Google Sign-In is not configured. Please use email and password.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
        <ThemeToggle />
      </div>
      <div className="login-card animate-slide-up">

        <div className="login-logo">
          <span className="login-logo-text">TK Intern Hub</span>
          <span className="login-logo-sub">Talakunchi Networks — Internal Platform</span>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <button
          id="btn-google-login"
          className="btn btn-google"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{ marginBottom: 0 }}
        >
          {googleLoading ? (
            <div className="spinner" style={{ width: 18, height: 18 }} />
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google Workspace
        </button>

        <div className="divider"><span>or sign in with password</span></div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Company Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="yourname@talakunchi.in"

              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

          </div>
          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px" }}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--color-text-dim)" }}>
          This platform is restricted to Talakunchi Networks employees.<br />
          Contact your Admin to get access.
        </p>
      </div>
    </div>
  );
}
