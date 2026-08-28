"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import { useAuth } from "@/lib/auth-context";
import {
  ResumeData,
  ATSScoreResult,
  listUserResumes,
  scoreResumeAts,
  updateResumeContent,
} from "@/lib/api";

const SAMPLE_JD = `Senior AI & Backend Software Engineer
We are seeking an experienced AI Software Engineer to join our core product team.

Responsibilities:
- Architect, build, and deploy scalable RESTful APIs using Python, FastAPI, and PostgreSQL.
- Build and optimize Retrieval-Augmented Generation (RAG) pipelines using LangChain, Qdrant, and PyTorch.
- Containerize services with Docker and orchestrate production deployments using Kubernetes.
- Implement robust CI/CD automated test and deployment pipelines with GitHub Actions.
- Manage AWS cloud infrastructure, monitoring latency with Prometheus and Grafana.

Requirements:
- 3+ years experience with Python, FastAPI, and relational databases (PostgreSQL, MySQL).
- Hands-on experience with Docker, Kubernetes, and CI/CD automation.
- Proven background in Machine Learning, LLMs, and RAG architectures.
- Experience with Cloud infrastructure (AWS or GCP).
- Strong problem-solving and communication skills.`;

export default function AtsCheckerPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [loadingResumes, setLoadingResumes] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [scoreResult, setScoreResult] = useState<ATSScoreResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addedSkills, setAddedSkills] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadResumes() {
      try {
        setLoadingResumes(true);
        const data = await listUserResumes();
        setResumes(data);
        if (data.length > 0) {
          setSelectedResumeId(data[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load resumes", err);
      } finally {
        setLoadingResumes(false);
      }
    }
    if (user) {
      loadResumes();
    }
  }, [user]);

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || null;

  const handleAnalyze = async () => {
    if (!selectedResumeId) {
      setErrorMsg("Please select a resume to analyze.");
      return;
    }
    if (!jobDescription || jobDescription.trim().length < 15) {
      setErrorMsg("Please paste a target Job Description (at least 15 characters).");
      return;
    }

    try {
      setAnalyzing(true);
      setErrorMsg(null);
      const res = await scoreResumeAts(selectedResumeId, jobDescription, selectedResume?.content);
      setScoreResult(res);

      // Update local resume ats_score state
      setResumes((prev) =>
        prev.map((r) => (r.id === selectedResumeId ? { ...r, ats_score: res.overall_score } : r))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze resume against Job Description.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuickAddSkill = async (skill: string) => {
    if (!selectedResume) return;
    const currentSkills = selectedResume.content.skills || [];
    if (currentSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase())) {
      return;
    }

    const updatedSkills = [...currentSkills, skill];
    const updatedContent = {
      ...selectedResume.content,
      skills: updatedSkills,
    };

    try {
      await updateResumeContent(selectedResume.id, selectedResume.title, updatedContent);
      setAddedSkills((prev) => new Set([...Array.from(prev), skill]));
      setSuccessMsg(`Added "${skill}" to skills! Click 'Re-analyze' to update your ATS score.`);
      setTimeout(() => setSuccessMsg(null), 3500);

      // Update local selectedResume content
      setResumes((prev) =>
        prev.map((r) => (r.id === selectedResume.id ? { ...r, content: updatedContent } : r))
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add skill.");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#16A34A"; // Green
    if (score >= 75) return "#2563EB"; // Blue
    if (score >= 50) return "#F59E0B"; // Amber
    return "#EF4444"; // Red
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 90) return "#DCFCE7";
    if (score >= 75) return "#DBEAFE";
    if (score >= 50) return "#FEF3C7";
    return "#FEE2E2";
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", color: "#0F172A", fontFamily: "'Inter', sans-serif" }}>
        {/* Navigation Bar */}
        <nav style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "0 24px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontWeight: 800, fontSize: "16px" }}>
                P
              </div>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>PrepCV</span>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => router.push("/dashboard")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 500, color: "#64748B", cursor: "pointer" }}>
                Dashboard
              </button>
              <button onClick={() => router.push("/profile")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 500, color: "#64748B", cursor: "pointer" }}>
                Profile
              </button>
              <button style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#EFF6FF", fontSize: "14px", fontWeight: 600, color: "#2563EB", cursor: "pointer" }}>
                🎯 ATS Checker
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#475569" }}>{user?.full_name}</span>
            <button onClick={() => logout()} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: "13px", fontWeight: 500, color: "#64748B", cursor: "pointer" }}>
              Sign Out
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
          {/* Header Banner */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", background: "#EFF6FF", color: "#2563EB", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              <span>⚡ Step 5 — ATS Match Scoring</span>
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              ATS Compatibility Checker
            </h1>
            <p style={{ fontSize: "15px", color: "#64748B", margin: 0 }}>
              Paste a target job description to score your resume, detect missing keywords, and get concrete suggestions to pass recruiter screeners.
            </p>
          </div>

          {errorMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#B91C1C", fontSize: "14px", marginBottom: "20px" }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", color: "#15803D", fontSize: "14px", marginBottom: "20px" }}>
              {successMsg}
            </div>
          )}

          {/* Top Inputs: Target JD & Resume Selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "24px", marginBottom: "32px" }}>
            {/* Target Job Description */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                  Target Job Description
                </label>
                <button
                  onClick={() => setJobDescription(SAMPLE_JD)}
                  style={{ fontSize: "12px", color: "#7C3AED", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  ✨ Load Example JD
                </button>
              </div>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the complete job description here (responsibilities, required skills, tools)..."
                rows={9}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13.5px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: "#94A3B8" }}>
                <span>Include requirements and technical skills for best results</span>
                <span>{jobDescription.length} characters</span>
              </div>
            </div>

            {/* Resume Selector & Actions */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "10px" }}>
                  Select Resume to Analyze
                </label>

                {loadingResumes ? (
                  <div style={{ fontSize: "13px", color: "#94A3B8", padding: "20px 0" }}>Loading resumes...</div>
                ) : resumes.length === 0 ? (
                  <div style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1", textAlign: "center" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>No Resumes Found</div>
                    <button onClick={() => router.push("/profile")} style={{ padding: "6px 14px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      Generate Resume First
                    </button>
                  </div>
                ) : (
                  <div>
                    <select
                      value={selectedResumeId}
                      onChange={(e) => {
                        setSelectedResumeId(e.target.value);
                        setScoreResult(null);
                      }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 600, color: "#0F172A", marginBottom: "14px", outline: "none", backgroundColor: "#F8FAFC" }}
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} (v{r.version || 1}) {r.ats_score ? `• ${r.ats_score}% ATS` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedResume && (
                      <div style={{ padding: "14px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{selectedResume.title}</span>
                          <span style={{ fontSize: "12px", fontWeight: 600, padding: "2px 8px", borderRadius: "12px", backgroundColor: "#E0E7FF", color: "#4338CA" }}>
                            Version {selectedResume.version || 1}
                          </span>
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#64748B", marginBottom: "8px" }}>
                          Candidate: <strong style={{ color: "#334155" }}>{selectedResume.content.personal_info?.full_name || "Profile"}</strong>
                          {selectedResume.content.personal_info?.professional_title && ` • ${selectedResume.content.personal_info.professional_title}`}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "11.5px" }}>
                          <span style={{ padding: "2px 6px", background: "#E2E8F0", borderRadius: "4px", color: "#475569" }}>
                            {(selectedResume.content.skills || []).length} Skills
                          </span>
                          <span style={{ padding: "2px 6px", background: "#E2E8F0", borderRadius: "4px", color: "#475569" }}>
                            {(selectedResume.content.experience || []).length} Roles
                          </span>
                          <span style={{ padding: "2px 6px", background: "#E2E8F0", borderRadius: "4px", color: "#475569" }}>
                            {(selectedResume.content.projects || []).length} Projects
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !selectedResumeId || !jobDescription.trim()}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: analyzing ? "#94A3B8" : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: analyzing ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {analyzing ? "⚡ Evaluating ATS Keywords..." : scoreResult ? "🔄 Re-analyze Resume" : "Analyze Resume Match →"}
                </button>

                {selectedResumeId && (
                  <button
                    onClick={() => router.push(`/resumes/${selectedResumeId}`)}
                    style={{ padding: "12px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", color: "#334155", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                    title="Open in Resume Editor"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ATS Analysis Results View */}
          {scoreResult && (
            <div style={{ animation: "fadeIn 0.4s ease-in-out" }}>
              {/* ATS Hero Card */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "28px", marginBottom: "28px", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "32px", alignItems: "center" }}>
                  {/* Circular / Big Gauge */}
                  <div style={{ textAlign: "center", paddingRight: "24px", borderRight: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      ATS MATCH SCORE
                    </div>
                    <div style={{ fontSize: "56px", fontWeight: 900, color: getScoreColor(scoreResult.overall_score), lineHeight: 1 }}>
                      {scoreResult.overall_score}%
                    </div>
                    <div style={{ display: "inline-block", marginTop: "8px", padding: "4px 14px", borderRadius: "999px", backgroundColor: getScoreBadgeBg(scoreResult.overall_score), color: getScoreColor(scoreResult.overall_score), fontSize: "13px", fontWeight: 700 }}>
                      {scoreResult.score_tier}
                    </div>

                    {/* Previous score delta tracker */}
                    {scoreResult.score_change !== null && scoreResult.score_change !== undefined && (
                      <div style={{ marginTop: "10px", fontSize: "12px", fontWeight: 600, color: scoreResult.score_change >= 0 ? "#16A34A" : "#EF4444" }}>
                        {scoreResult.score_change >= 0 ? `↑ +${scoreResult.score_change} pts` : `↓ ${scoreResult.score_change} pts`} (from {scoreResult.previous_score}%)
                      </div>
                    )}

                    <div style={{ marginTop: "12px", fontSize: "12.5px", color: "#64748B" }}>
                      <strong>{scoreResult.keyword_stats.matched_keywords_count}</strong> of <strong>{scoreResult.keyword_stats.total_jd_keywords_count}</strong> keywords found
                    </div>
                  </div>

                  {/* Summary & Category Bars */}
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                      {scoreResult.score_summary}
                    </h3>
                    <p style={{ fontSize: "13.5px", color: "#64748B", margin: "0 0 20px 0" }}>
                      This score reflects how well your keywords, technical skills, and experience align with the job description.
                    </p>

                    {/* Breakdown bars */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Keyword Match</span>
                          <span>{scoreResult.breakdown.keyword_match}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${scoreResult.breakdown.keyword_match}%`, height: "100%", backgroundColor: getScoreColor(scoreResult.breakdown.keyword_match), borderRadius: "999px" }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Skills Match</span>
                          <span>{scoreResult.breakdown.skills_match}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${scoreResult.breakdown.skills_match}%`, height: "100%", backgroundColor: getScoreColor(scoreResult.breakdown.skills_match), borderRadius: "999px" }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Experience Match</span>
                          <span>{scoreResult.breakdown.experience_match}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${scoreResult.breakdown.experience_match}%`, height: "100%", backgroundColor: getScoreColor(scoreResult.breakdown.experience_match), borderRadius: "999px" }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Education Match</span>
                          <span>{scoreResult.breakdown.education_match}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#F1F5F9", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${scoreResult.breakdown.education_match}%`, height: "100%", backgroundColor: getScoreColor(scoreResult.breakdown.education_match), borderRadius: "999px" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Column: Missing Keywords vs Matching Skills */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", marginBottom: "28px" }}>
                {/* 🔴 Missing Keywords */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "18px" }}>⚠️</span>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      Missing from Your Resume ({scoreResult.missing_keywords.length})
                    </h2>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0" }}>
                    These skills are highlighted in the JD but not found in your resume. Add if you have hands-on experience:
                  </p>

                  {scoreResult.missing_keywords.length === 0 ? (
                    <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: "8px", color: "#16A34A", fontSize: "13.5px", fontWeight: 600 }}>
                      ✓ Outstanding! All key job description skills were found in your resume.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {scoreResult.missing_keywords.map((kw, i) => {
                        const isAdded = addedSkills.has(kw.skill);
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "8px",
                              backgroundColor: isAdded ? "#F0FDF4" : "#FEF2F2",
                              border: `1px solid ${isAdded ? "#86EFAC" : "#FECACA"}`,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: isAdded ? "#15803D" : "#991B1B" }}>
                                {isAdded ? `✓ ${kw.skill}` : kw.skill}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748B" }}>
                                Mentioned {kw.count_in_jd}× in job description • Not in resume
                              </div>
                            </div>

                            <button
                              onClick={() => handleQuickAddSkill(kw.skill)}
                              disabled={isAdded}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "none",
                                backgroundColor: isAdded ? "#DCFCE7" : "#16A34A",
                                color: isAdded ? "#16A34A" : "#FFFFFF",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: isAdded ? "default" : "pointer",
                              }}
                            >
                              {isAdded ? "Added ✓" : "+ Add to Skills"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 🟢 Matching Skills */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "18px" }}>✅</span>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      Matching Skills Confirmed ({scoreResult.matching_skills.length})
                    </h2>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0" }}>
                    Your resume successfully verified these core requirements:
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {scoreResult.matching_skills.map((skill, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "20px",
                          backgroundColor: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          color: "#15803D",
                          fontSize: "13px",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <span>✓</span> {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 💡 Actionable Recommendations */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0" }}>
                      💡 Actionable Optimization Recommendations
                    </h2>
                    <p style={{ fontSize: "13.5px", color: "#64748B", margin: 0 }}>
                      Concrete changes to boost your ATS match and recruiter click-through rate:
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                  {scoreResult.recommendations.map((rec, i) => (
                    <div
                      key={rec.id || i}
                      style={{
                        padding: "16px",
                        borderRadius: "10px",
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#7C3AED", color: "#FFFFFF", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                            {rec.title}
                          </span>
                        </div>
                        <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 12px 0" }}>
                          {rec.description}
                        </p>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        {rec.action_type === "add_skill" && rec.target_text ? (
                          <button
                            onClick={() => handleQuickAddSkill(rec.target_text!)}
                            style={{ padding: "6px 12px", backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                          >
                            + Add Skill
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/resumes/${selectedResumeId}`)}
                            style={{ padding: "6px 12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                          >
                            ✏️ Edit in Resume
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Jump-to-Editor CTA */}
              <div style={{ backgroundColor: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)", background: "#0F172A", borderRadius: "12px", padding: "24px", color: "#FFFFFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                    Ready to implement these changes and save a new version?
                  </div>
                  <div style={{ fontSize: "13.5px", color: "#94A3B8" }}>
                    Open your resume editor to edit bullets, apply AI improvements, and keep version history.
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/resumes/${selectedResumeId}`)}
                  style={{ padding: "12px 24px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.4)" }}
                >
                  Open Resume Editor →
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
