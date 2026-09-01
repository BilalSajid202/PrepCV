"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import SidebarLayout from "@/components/sidebar-layout";
import { useAuth } from "@/lib/auth-context";
import {
  ResumeData,
  ATSScoreResult,
  listUserResumes,
  scoreResumeAts,
  updateResumeContent,
} from "@/lib/api";
import {
  Sparkles,
  Target,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  Plus,
  ArrowRight,
  Zap,
  Lightbulb,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

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
  const { user } = useAuth();

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
      <SidebarLayout>
        <div style={{ maxWidth: "1000px" }}>
          {/* Header Banner */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", background: "#EFF6FF", color: "#2563EB", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>
              <Zap size={14} />
              <span>Step 5 — ATS Match Scoring</span>
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              ATS Compatibility Checker
            </h1>
            <p style={{ fontSize: "14.5px", color: "#64748B", margin: 0 }}>
              Paste a target job description to score your resume, detect missing keywords, and get concrete suggestions to pass recruiter screeners.
            </p>
          </div>

          {errorMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#B91C1C", fontSize: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ padding: "12px 16px", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", color: "#15803D", fontSize: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Top Inputs: Target JD & Resume Selector */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "20px", marginBottom: "32px" }}>
            {/* Target Job Description */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                  Target Job Description
                </label>
                <button
                  onClick={() => setJobDescription(SAMPLE_JD)}
                  style={{ fontSize: "12px", color: "#7C3AED", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Sparkles size={13} />
                  <span>Load Example JD</span>
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
                <span>Include requirements and skills</span>
                <span>{jobDescription.length} chars</span>
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
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Active Resume: {selectedResume.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B" }}>
                          Role: {selectedResume.content?.personal_info?.professional_title || "General"} • {selectedResume.content?.skills?.length || 0} skills indexed
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !selectedResumeId || !jobDescription}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    backgroundColor: analyzing ? "#94A3B8" : "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
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
                  <Zap size={16} />
                  <span>{analyzing ? "Evaluating ATS..." : scoreResult ? "Re-analyze Resume" : "Analyze Resume Match"}</span>
                </button>

                {selectedResumeId && (
                  <button
                    onClick={() => router.push(`/resumes/${selectedResumeId}`)}
                    style={{ padding: "12px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", color: "#334155", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    title="Open in Resume Editor"
                  >
                    <Edit3 size={15} />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ATS Analysis Results View */}
          {scoreResult && (
            <div style={{ animation: "fadeIn 0.4s ease-in-out" }}>
              {/* ATS Hero Card */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "28px", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "24px", alignItems: "center" }}>
                  {/* Circular / Big Gauge */}
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      ATS MATCH SCORE
                    </div>
                    <div style={{ fontSize: "52px", fontWeight: 900, color: getScoreColor(scoreResult.overall_score), lineHeight: 1 }}>
                      {scoreResult.overall_score}%
                    </div>
                    <div style={{ display: "inline-block", marginTop: "8px", padding: "4px 14px", borderRadius: "999px", backgroundColor: getScoreBadgeBg(scoreResult.overall_score), color: getScoreColor(scoreResult.overall_score), fontSize: "13px", fontWeight: 700 }}>
                      {scoreResult.score_tier}
                    </div>

                    {scoreResult.score_change !== null && scoreResult.score_change !== undefined && (
                      <div style={{ marginTop: "10px", fontSize: "12px", fontWeight: 600, color: scoreResult.score_change >= 0 ? "#16A34A" : "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        {scoreResult.score_change >= 0 ? (
                          <>
                            <TrendingUp size={14} />
                            <span>+{scoreResult.score_change} pts (from {scoreResult.previous_score}%)</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={14} />
                            <span>{scoreResult.score_change} pts (from {scoreResult.previous_score}%)</span>
                          </>
                        )}
                      </div>
                    )}
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "14px" }}>
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
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Column: Missing Keywords vs Matching Skills */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "24px", marginBottom: "28px" }}>
                {/* Missing Keywords */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <AlertTriangle size={18} color="#DC2626" />
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      Missing from Your Resume ({scoreResult.missing_keywords.length})
                    </h2>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0" }}>
                    These skills are highlighted in the JD but not found in your resume. Add if you have hands-on experience:
                  </p>

                  {scoreResult.missing_keywords.length === 0 ? (
                    <div style={{ padding: "16px", backgroundColor: "#F0FDF4", borderRadius: "8px", color: "#16A34A", fontSize: "13.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={16} />
                      <span>Outstanding! All key job description skills were found in your resume.</span>
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
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: isAdded ? "#15803D" : "#991B1B", display: "flex", alignItems: "center", gap: "4px" }}>
                                {isAdded && <Check size={14} />}
                                <span>{kw.skill}</span>
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748B" }}>
                                Mentioned {kw.count_in_jd}× in JD • Not in resume
                              </div>
                            </div>

                            <button
                              onClick={() => handleQuickAddSkill(kw.skill)}
                              disabled={isAdded}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: isAdded ? "#16A34A" : "#2563EB",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: isAdded ? "default" : "pointer",
                                opacity: isAdded ? 0.8 : 1,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {isAdded ? (
                                <>
                                  <Check size={12} />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={12} />
                                  <span>Add to Skills</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Matching Skills */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <CheckCircle2 size={18} color="#16A34A" />
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      Matching Skills Found ({scoreResult.matching_skills.length})
                    </h2>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0" }}>
                    Great job! These terms were correctly detected in your resume and align with the JD requirements:
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {scoreResult.matching_skills.map((skill, i) => (
                      <span
                        key={i}
                        style={{
                          backgroundColor: "#F0FDF4",
                          color: "#16A34A",
                          border: "1px solid #BBF7D0",
                          borderRadius: "20px",
                          padding: "5px 12px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Check size={13} />
                        <span>{skill}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations List */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "28px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Lightbulb size={18} color="#2563EB" />
                  <span>Targeted ATS Recommendations ({scoreResult.recommendations.length})</span>
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {scoreResult.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "16px",
                        borderRadius: "8px",
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700,
                            backgroundColor: (rec.impact || "medium") === "high" ? "#FEE2E2" : (rec.impact || "medium") === "medium" ? "#FEF3C7" : "#EFF6FF",
                            color: (rec.impact || "medium") === "high" ? "#DC2626" : (rec.impact || "medium") === "medium" ? "#D97706" : "#2563EB",
                            textTransform: "uppercase"
                          }}>
                            {rec.impact || "medium"} impact
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>{rec.title}</span>
                        </div>
                        <p style={{ fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                          {rec.description}
                        </p>
                      </div>

                      <div>
                        {rec.action_type === "add_skill" && rec.target_text ? (
                          <button
                            onClick={() => handleQuickAddSkill(rec.target_text!)}
                            style={{ padding: "6px 12px", backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Plus size={13} />
                            <span>Add Skill</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/resumes/${selectedResumeId}`)}
                            style={{ padding: "6px 12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Edit3 size={13} />
                            <span>Edit in Resume</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Jump-to-Editor CTA */}
              <div style={{ backgroundColor: "#0F172A", borderRadius: "12px", padding: "20px 24px", color: "#FFFFFF", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
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
                  style={{ padding: "10px 20px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.4)", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <span>Open Resume Editor</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
