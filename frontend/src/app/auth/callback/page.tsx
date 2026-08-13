"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authApi, ApiError } from "@/lib/api";

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errParam = searchParams.get("error");

    if (errParam) {
      setError(`Google Auth Error: ${errParam}`);
      return;
    }

    if (!code) {
      setError("No authorization code provided in callback.");
      return;
    }

    authApi.googleCallback(code)
      .then((res) => {
        completeLogin(res.user);
      })
      .catch((err: ApiError) => {
        setError(err.message || "Failed to authenticate with Google.");
      });
  }, [searchParams, completeLogin, router]);

  if (error) {
    return (
      <div className="login-bg">
        <div className="login-card animate-slide-up" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-danger)", marginBottom: 12 }}>
            Authentication Failed
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 24 }}>
            {error}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/login")}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      <div className="login-card animate-slide-up" style={{ textAlign: "center", padding: "48px 32px" }}>
        <div className="spinner" style={{ margin: "0 auto 20px", width: 36, height: 36 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)" }}>
          Authenticating with Google Workspace...
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text-dim)", marginTop: 6 }}>
          Verifying your Talakunchi account credentials (@talakunchi.in / @talakunchi.com)

        </p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="loading-overlay"><div className="spinner" /></div>}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
