"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Check, Sparkles, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Brand Panel (Desktop Split-Screen) */}
      <div className="auth-brand-panel">
        <div className="brand-header">
          <div className="brand-logo">
            Prep<span>CV</span>
          </div>
        </div>

        <div className="brand-body">
          <h1 className="brand-title">Your career,<br />optimized by AI.</h1>
          <p className="brand-subtitle">Build your resume. Prepare for interviews. Get hired.</p>

          <ul className="brand-features">
            <li>
              <span className="feature-check" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={14} />
              </span>
              <span>Build an ATS-friendly resume.</span>
            </li>
            <li>
              <span className="feature-check" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={14} />
              </span>
              <span>Practice job-specific interviews.</span>
            </li>
            <li>
              <span className="feature-check" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={14} />
              </span>
              <span>Improve with every application.</span>
            </li>
          </ul>
        </div>

        <div className="brand-footer">
          <div className="ai-badge" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={14} />
            <span>AI-powered career preparation</span>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="mobile-brand-logo">
            Prep<span style={{ color: "#2563EB" }}>CV</span>
          </div>

          <div className="auth-header">
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-subtitle">Sign in to continue</p>
          </div>

          {error && (
            <div className="alert-error" style={{ marginBottom: "20px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-wrapper">
                <input
                  id="email"
                  type="email"
                  required
                  className="form-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>{submitting ? "Signing in..." : "Sign In"}</span>
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="divider">or</div>

          <div className="auth-footer-link">
            Don't have an account? <Link href="/signup">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
