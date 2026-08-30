"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import SidebarLayout from "@/components/sidebar-layout";
import {
  InterviewFeedbackItem,
  submitInterviewFeedback,
  listUserFeedback,
} from "@/lib/api";

function InterviewFeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [companyName, setCompanyName] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [actualQuestionsText, setActualQuestionsText] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackList, setFeedbackList] = useState<InterviewFeedbackItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const compParam = searchParams.get("company");
    const roleParam = searchParams.get("role");
    const sessParam = searchParams.get("sessionId");

    if (compParam) setCompanyName(compParam);
    if (roleParam) setJobTitle(roleParam);
    if (sessParam) setSessionId(sessParam);

    loadUserFeedback();
  }, [searchParams]);

  const loadUserFeedback = async () => {
    try {
      const list = await listUserFeedback();
      setFeedbackList(list);
    } catch (err) {
      console.warn("Could not load feedback history", err);
    }
  };

  const handleFillSample = () => {
    setCompanyName("Stripe");
    setJobTitle("Senior Backend Engineer");
    setIndustry("Fintech");
    setActualQuestionsText(
      "1. How do you design an idempotency key pattern in Redis and FastAPI?\n2. Explain how you diagnose and prevent deadlocks in PostgreSQL.\n3. Tell me about a time you led a large database migration without any downtime."
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualQuestionsText.trim() || actualQuestionsText.trim().length < 10) {
      setErrorMsg("Please enter the questions that were asked (at least 10 characters).");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await submitInterviewFeedback({
        session_id: sessionId || undefined,
        actual_questions_text: actualQuestionsText,
        company_name: companyName || undefined,
        job_title: jobTitle || undefined,
        industry: industry || undefined,
      });

      setSuccessMsg(`Feedback saved and anonymized! Generated tags: ${res.company_tag} / ${res.role_tag}.`);
      setActualQuestionsText("");
      await loadUserFeedback();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
          💡 Post-Interview Feedback Capture (RAG Loop)
        </h1>
        <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
          Report what interviewers actually asked. Your feedback is automatically anonymized and empowers future question generation.
        </p>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: "#FEF2F2", color: "#DC2626", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "13.5px" }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: "#F0FDF4", color: "#16A34A", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "13.5px" }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Form Card */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
            What questions were actually asked?
          </h2>
          <button
            type="button"
            onClick={handleFillSample}
            style={{ background: "none", border: "none", color: "#7C3AED", fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
          >
            ✨ Load Example Feedback
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Stripe"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Role / Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Industry (Optional)
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Fintech, Healthcare"
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Actual Questions Asked *
            </label>
            <textarea
              rows={6}
              required
              value={actualQuestionsText}
              onChange={(e) => setActualQuestionsText(e.target.value)}
              placeholder="Paste or list the actual technical, behavioral, or system design questions asked during your interview rounds..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 }}
            />
          </div>

          {/* Privacy & Anonymization Notice */}
          <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", padding: "12px 16px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>🛡️</span>
            <span style={{ fontSize: "12.5px", color: "#15803D", lineHeight: 1.4 }}>
              <strong>Privacy Guaranteed (NFR-5):</strong> All names, email addresses, phone numbers, and candidate contact links are automatically sanitized and stripped before cross-user RAG indexing.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: "#7C3AED",
                color: "#FFFFFF",
                border: "none",
                padding: "11px 24px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Sanitizing & Saving..." : "Submit Anonymized Feedback →"}
            </button>
          </div>
        </form>
      </div>

      {/* Past Feedback History Section */}
      <div>
        <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "14px" }}>
          My Submitted Interview Feedback ({feedbackList.length})
        </h2>

        {feedbackList.length === 0 ? (
          <div style={{ padding: "24px", backgroundColor: "#FFFFFF", borderRadius: "8px", border: "1px dashed #CBD5E1", textAlign: "center", color: "#64748B", fontSize: "13.5px" }}>
            No interview feedback submitted yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ backgroundColor: "#EFF6FF", color: "#2563EB", padding: "2px 8px", borderRadius: "12px", fontSize: "11.5px", fontWeight: 700 }}>
                      #{fb.company_tag}
                    </span>
                    <span style={{ backgroundColor: "#F5F3FF", color: "#7C3AED", padding: "2px 8px", borderRadius: "12px", fontSize: "11.5px", fontWeight: 700 }}>
                      #{fb.role_tag}
                    </span>
                    <span style={{ backgroundColor: "#ECFDF5", color: "#059669", padding: "2px 8px", borderRadius: "12px", fontSize: "11.5px", fontWeight: 700 }}>
                      #{fb.industry_tag}
                    </span>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "#64748B" }}>
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {fb.anonymized_questions_text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewFeedbackPage() {
  return (
    <ProtectedRoute>
      <SidebarLayout>
        <Suspense fallback={<div style={{ padding: "32px", color: "#64748B" }}>Loading feedback form...</div>}>
          <InterviewFeedbackContent />
        </Suspense>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
