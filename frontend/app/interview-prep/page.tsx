"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import SidebarLayout from "@/components/sidebar-layout";
import {
  ResumeData,
  InterviewSession,
  InterviewQuestion,
  listUserResumes,
  generateInterviewQuestions,
} from "@/lib/api";

const SAMPLE_JD = `Senior Backend & Distributed Systems Engineer
Company: Stripe
Location: Remote / San Francisco

Responsibilities:
- Build high-availability payment processing engines and financial ledger pipelines with Python, FastAPI, and Redis.
- Architect idempotent API endpoints handling millions of transactions with sub-100ms latency.
- Resolve database concurrency, deadlocks, and schema evolutions in PostgreSQL.
- Partner with infrastructure teams on Kubernetes container orchestration and CI/CD automation.

Requirements:
- 4+ years software engineering experience with Python and relational databases.
- Deep understanding of distributed transactions, idempotency patterns, and data consistency.
- Experience with microservices, Docker, Redis, and cloud infrastructure.`;

export default function InterviewPrepPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState<string>("");
  const [companyUrl, setCompanyUrl] = useState<string>("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [resumes, setResumes] = useState<ResumeData[]>([]);

  // Generation state
  const [generating, setGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<InterviewSession | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("All");
  const [copiedQuestionId, setCopiedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadResumes() {
      try {
        const list = await listUserResumes();
        setResumes(list);
        if (list.length > 0) {
          setSelectedResumeId(list[0].id);
        }
      } catch (err) {
        console.error("Could not load resumes", err);
      }
    }
    loadResumes();
  }, []);

  const handleFillSample = () => {
    setCompanyName("Stripe");
    setCompanyUrl("https://stripe.com");
    setJobTitle("Senior Backend Engineer");
    setJdText(SAMPLE_JD);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !jobTitle.trim()) {
      setErrorMsg("Please enter at least Company Name and Target Job Title.");
      return;
    }

    try {
      setGenerating(true);
      setErrorMsg(null);

      // Visual progress feedback
      setGenerationStep("🔍 Researching company intelligence with Tavily...");
      setTimeout(() => {
        setGenerationStep("🧠 Querying past interview questions in RAG memory...");
      }, 2500);
      setTimeout(() => {
        setGenerationStep("⚡ Synthesizing tailored Behavioral, Technical & Role-Specific questions...");
      }, 5500);

      const session = await generateInterviewQuestions({
        company_name: companyName,
        job_title: jobTitle,
        company_url: companyUrl,
        jd_text: jdText,
        resume_id: selectedResumeId || undefined,
      });

      setCreatedSession(session);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate interview questions.");
    } finally {
      setGenerating(false);
      setGenerationStep("");
    }
  };

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionId(id);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  const handleCopyAll = () => {
    if (!createdSession) return;
    const allText = createdSession.generated_questions
      .map((q, idx) => `${idx + 1}. [${q.category}] ${q.question}`)
      .join("\n\n");
    navigator.clipboard.writeText(allText);
    alert("All interview questions copied to clipboard!");
  };

  const filteredQuestions = createdSession
    ? activeCategoryFilter === "All"
      ? createdSession.generated_questions
      : createdSession.generated_questions.filter((q) => q.category === activeCategoryFilter)
    : [];

  const getCategoryColor = (cat: string) => {
    if (cat === "Behavioral") return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };
    if (cat === "Technical") return { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" };
    return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
  };

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div style={{ maxWidth: "900px" }}>
          
          {/* Header */}
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              💬 AI Interview Question Generator
            </h1>
            <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
              Generate a tailored question set combining live company intelligence, target job requirements, and past interview data.
            </p>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: "#FEF2F2", color: "#DC2626", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "13.5px" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form Card (Hidden or collapsible when results are generated) */}
          {!createdSession ? (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Target Role & Company Details
                </h2>
                <button
                  type="button"
                  onClick={handleFillSample}
                  style={{ background: "none", border: "none", color: "#7C3AED", fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  ✨ Load Example (Stripe)
                </button>
              </div>

              <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Target Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Stripe, Airbnb, Google"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Company Website URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={companyUrl}
                      onChange={(e) => setCompanyUrl(e.target.value)}
                      placeholder="e.g. https://stripe.com"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Target Job Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Select Saved Resume / CV
                    </label>
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", backgroundColor: "#FFFFFF", boxSizing: "border-box" }}
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} (v{r.version || 1})
                        </option>
                      ))}
                      {resumes.length === 0 && <option value="">No resumes yet (will use profile)</option>}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Job Description (Paste JD Text)
                  </label>
                  <textarea
                    rows={6}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the target job description here..."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                  <button
                    type="submit"
                    disabled={generating}
                    style={{
                      background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "12px 28px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: generating ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {generating ? "⚡ Preparing Session..." : "Generate Tailored Questions →"}
                  </button>
                </div>
              </form>

              {generating && (
                <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB", marginBottom: "4px" }}>
                    {generationStep}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Analyzing company domain, engineering requirements, and interview patterns...
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Results View */
            <div>
              {/* Top Banner with Company Info & New Search Button */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                      {createdSession.company_name}
                    </span>
                    <span style={{ backgroundColor: "#EFF6FF", color: "#2563EB", fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                      {createdSession.job_title}
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#64748B" }}>
                    {createdSession.generated_questions.length} Tailored Questions Generated • Verified ATS & RAG Alignment
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleCopyAll}
                    style={{ padding: "8px 14px", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, color: "#334155", cursor: "pointer" }}
                  >
                    📋 Copy All
                  </button>
                  <button
                    onClick={() => setCreatedSession(null)}
                    style={{ padding: "8px 16px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                  >
                    ＋ New Question Set
                  </button>
                </div>
              </div>

              {/* Category Filter Switcher */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                {["All", "Behavioral", "Technical", "Role-Specific"].map((cat) => {
                  const count =
                    cat === "All"
                      ? createdSession.generated_questions.length
                      : createdSession.generated_questions.filter((q) => q.category === cat).length;
                  const isSelected = activeCategoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategoryFilter(cat)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        border: `1px solid ${isSelected ? "#2563EB" : "#E2E8F0"}`,
                        backgroundColor: isSelected ? "#EFF6FF" : "#FFFFFF",
                        color: isSelected ? "#2563EB" : "#475569",
                        fontSize: "13px",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Questions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredQuestions.map((q, idx) => {
                  const catStyle = getCategoryColor(q.category);
                  const isCopied = copiedQuestionId === q.id;
                  return (
                    <div
                      key={q.id || idx}
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "10px",
                        border: "1px solid #E2E8F0",
                        padding: "20px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ backgroundColor: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`, padding: "2px 8px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 700 }}>
                            {q.category}
                          </span>
                          {q.difficulty && (
                            <span style={{ backgroundColor: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                              {q.difficulty}
                            </span>
                          )}
                          {q.focus_area && (
                            <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 500 }}>
                              Focus: {q.focus_area}
                            </span>
                          )}
                          {q.source === "rag_community_feedback" && (
                            <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                              💡 Real Interview Feedback
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopyQuestion(q.id, q.question)}
                          style={{
                            background: "none",
                            border: "1px solid #E2E8F0",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: isCopied ? "#16A34A" : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          {isCopied ? "✓ Copied" : "Copy"}
                        </button>
                      </div>

                      <div style={{ fontSize: "14.5px", color: "#0F172A", fontWeight: 600, lineHeight: 1.5 }}>
                        {q.question}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom CTA for Feedback Logging */}
              <div style={{ marginTop: "28px", padding: "20px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "14px", color: "#0F172A", display: "block" }}>
                    Did you complete your real interview at {createdSession.company_name}?
                  </strong>
                  <span style={{ fontSize: "12.5px", color: "#64748B" }}>
                    Log what was actually asked to empower future candidates and strengthen the RAG loop.
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/interview-feedback?company=${encodeURIComponent(createdSession.company_name)}&role=${encodeURIComponent(createdSession.job_title)}&sessionId=${encodeURIComponent(createdSession.id)}`)}
                  style={{ padding: "8px 16px", backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  💡 Log Interview Feedback →
                </button>
              </div>
            </div>
          )}

        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
