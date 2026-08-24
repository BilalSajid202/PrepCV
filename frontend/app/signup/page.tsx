"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live password strength calculation
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { level: 0, text: "", color: "#E2E8F0" };
    let score = 0;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

    if (score === 1) return { level: 33, text: "Weak", color: "#DC2626" };
    if (score === 2) return { level: 66, text: "Medium", color: "#D97706" };
    return { level: 100, text: "Strong", color: "#16A34A" };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedTerms) {
      setError("Please agree to the Terms & Privacy Policy to continue.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      await register(fullName, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your information.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Brand Panel */}
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
              <span className="feature-check">✓</span>
              <span>Build an ATS-friendly resume.</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Practice job-specific interviews.</span>
            </li>
            <li>
              <span className="feature-check">✓</span>
              <span>Improve with every application.</span>
            </li>
          </ul>
        </div>

        <div className="brand-footer">
          <div className="ai-badge">
            ✦ AI-powered career preparation
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
            <h2 className="auth-title">Create your account</h2>
            <p className="auth-subtitle">
              Your next opportunity starts here.
            </p>
          </div>

          {error && (
            <div className="alert-error" style={{ marginBottom: "20px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full name</label>
              <div className="input-wrapper">
                <input
                  id="fullName"
                  type="text"
                  required
                  className="form-input"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

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
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>

              {password.length > 0 && (
                <div className="strength-meter">
                  <div className="strength-bar-bg">
                    <div
                      className="strength-bar-fill"
                      style={{
                        width: `${strength.level}%`,
                        backgroundColor: strength.color,
                      }}
                    />
                  </div>
                  <div className="strength-text" style={{ color: strength.color }}>
                    {strength.text}
                  </div>
                </div>
              )}
            </div>

            <label className="checkbox-group">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
              />
              <span className="checkbox-label">
                I agree to the Terms &amp; Privacy Policy
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? "Creating Account..." : "Create Account →"}
            </button>
          </form>

          <div className="divider">or</div>

          <div className="auth-footer-link">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
