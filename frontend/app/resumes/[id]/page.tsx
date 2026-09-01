"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import {
  ResumeData,
  ResumeContent,
  ResumeVersion,
  ATSScoreResult,
  VersionCompareResult,
  fetchResumeById,
  updateResumeContent,
  aiImproveBullet,
  fetchResumeHtml,
  fetchPreviewHtml,
  downloadResumeDocx,
  scoreResumeAts,
  fetchResumeVersions,
  createResumeVersion,
  restoreResumeVersion,
  compareResumeVersions,
  deleteResume,
} from "@/lib/api";
import {
  Edit3,
  Target,
  History,
  Save,
  Plus,
  FileText,
  FileDown,
  AlertTriangle,
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw,
  Split,
  Lightbulb,
  ArrowRight,
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";

function formatDisplayUrl(url?: string): string {
  if (!url) return "";
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

const SAMPLE_JD = `Senior AI & Backend Software Engineer
We are seeking an experienced AI Software Engineer to join our product team.

Responsibilities:
- Architect, build, and deploy scalable RESTful APIs using Python, FastAPI, and PostgreSQL.
- Build and optimize Retrieval-Augmented Generation (RAG) pipelines using LangChain, Qdrant, and PyTorch.
- Containerize services with Docker and orchestrate production deployments using Kubernetes.
- Implement robust CI/CD automated test and deployment pipelines with GitHub Actions.
- Manage AWS cloud infrastructure, monitoring latency with Prometheus and Grafana.

Requirements:
- 3+ years experience with Python, FastAPI, and relational databases (PostgreSQL, MySQL).
- Hands-on experience with Docker, Kubernetes, and CI/CD automation.
- Background in Machine Learning, LLMs, and RAG architectures.
- Experience with Cloud infrastructure (AWS or GCP).`;

type WorkspaceTab = "editor" | "ats" | "versions";

export default function ResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const resumeId = params?.id as string;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("editor");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAtsComplianceModal, setShowAtsComplianceModal] = useState<boolean>(false);
  const [htmlPreview, setHtmlPreview] = useState<string>("");

  const [title, setTitle] = useState<string>("ATS Optimized Resume");
  const [activeVersionNum, setActiveVersionNum] = useState<number>(1);
  const [content, setContent] = useState<ResumeContent>({
    personal_info: {},
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  });

  // Step 5: ATS Scoring state
  const [targetJd, setTargetJd] = useState<string>("");
  const [atsScoreResult, setAtsScoreResult] = useState<ATSScoreResult | null>(null);
  const [atsAnalyzing, setAtsAnalyzing] = useState<boolean>(false);

  // Step 6: Versioning state
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [showSaveVersionModal, setShowSaveVersionModal] = useState<boolean>(false);
  const [versionChangeNote, setVersionChangeNote] = useState<string>("");
  const [savingNewVersion, setSavingNewVersion] = useState<boolean>(false);

  // Version Diff & Restore state
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<ResumeVersion | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<boolean>(false);
  const [diffBaseId, setDiffBaseId] = useState<string>("");
  const [diffComparedId, setDiffComparedId] = useState<string>("");
  const [diffResult, setDiffResult] = useState<VersionCompareResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);

  // AI Improvement Modal / Suggestion state
  const [improvingIndex, setImprovingIndex] = useState<{ type: string; expIdx?: number; bulletIdx?: number } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ text: string; explanation?: string } | null>(null);
  const [exportingDocx, setExportingDocx] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadHtmlPreview = async (id: string, currentContent?: ResumeContent) => {
    try {
      const html = await fetchResumeHtml(id);
      setHtmlPreview(html);
    } catch (err) {
      if (currentContent) {
        try {
          const previewHtml = await fetchPreviewHtml(currentContent);
          setHtmlPreview(previewHtml);
        } catch (pErr) {
          console.warn("Direct preview render failed:", pErr);
        }
      }
    }
  };

  const loadVersionsList = async () => {
    if (!resumeId) return;
    try {
      const vList = await fetchResumeVersions(resumeId);
      setVersions(vList);
      if (vList.length >= 2) {
        setDiffBaseId(vList[vList.length - 1].id);
        setDiffComparedId(vList[0].id);
      }
    } catch (err) {
      console.warn("Could not load versions", err);
    }
  };

  useEffect(() => {
    async function loadResume() {
      if (!resumeId) return;
      try {
        setLoading(true);
        const data = await fetchResumeById(resumeId);
        setTitle(data.title || "ATS Optimized Resume");
        setActiveVersionNum(data.version || 1);
        if (data.target_jd) setTargetJd(data.target_jd);

        let loadedContent: ResumeContent | undefined;
        if (data.content) {
          loadedContent = {
            personal_info: data.content.personal_info || data.profile_snapshot?.personal_info,
            summary: data.content.summary || "",
            experience: data.content.experience || [],
            education: data.content.education || [],
            skills: data.content.skills || [],
            projects: data.content.projects || [],
            certifications: data.content.certifications || [],
          };
          setContent(loadedContent);
        }
        await loadHtmlPreview(resumeId, loadedContent);
        await loadVersionsList();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load resume.");
      } finally {
        setLoading(false);
      }
    }
    loadResume();
  }, [resumeId]);

  // Handle standard in-place save
  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg(null);
      await updateResumeContent(resumeId, title, content);
      await loadHtmlPreview(resumeId, content);
      setSuccessMsg("Resume draft saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save resume.");
    } finally {
      setSaving(false);
    }
  };

  // Handle save as explicit new version
  const handleSaveNewVersion = async () => {
    try {
      setSavingNewVersion(true);
      setErrorMsg(null);
      const note = versionChangeNote.trim() || `Version ${activeVersionNum + 1} Update`;
      const newV = await createResumeVersion(
        resumeId,
        content,
        title,
        note,
        atsScoreResult?.overall_score || undefined
      );
      setActiveVersionNum(newV.version_number);
      await loadHtmlPreview(resumeId, content);
      await loadVersionsList();
      setShowSaveVersionModal(false);
      setVersionChangeNote("");
      setSuccessMsg(`Saved as Version ${newV.version_number} ("${note}")!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create new version.");
    } finally {
      setSavingNewVersion(false);
    }
  };

  // Handle safe restore of a prior version
  const handleRestoreVersion = async () => {
    if (!restoreConfirmVersion) return;
    try {
      setRestoringVersion(true);
      setErrorMsg(null);
      const restored = await restoreResumeVersion(resumeId, restoreConfirmVersion.id);
      setTitle(restored.title || title);
      setActiveVersionNum(restored.version || activeVersionNum + 1);
      setContent(restored.content);
      await loadHtmlPreview(resumeId, restored.content);
      await loadVersionsList();
      setRestoreConfirmVersion(null);
      setSuccessMsg(`Restored from Version ${restoreConfirmVersion.version_number}! Created Version ${restored.version}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore version.");
    } finally {
      setRestoringVersion(false);
    }
  };

  // Handle version compare
  const handleRunDiff = async () => {
    if (!diffBaseId || !diffComparedId) return;
    try {
      setLoadingDiff(true);
      const res = await compareResumeVersions(resumeId, diffBaseId, diffComparedId);
      setDiffResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to compare versions.");
    } finally {
      setLoadingDiff(false);
    }
  };

  // Handle ATS Score Analysis
  const handleRunAtsCheck = async () => {
    if (!targetJd || targetJd.trim().length < 15) {
      setErrorMsg("Please paste a target Job Description (at least 15 characters).");
      return;
    }
    try {
      setAtsAnalyzing(true);
      setErrorMsg(null);
      const res = await scoreResumeAts(resumeId, targetJd, content);
      setAtsScoreResult(res);
      setSuccessMsg(`ATS Analysis complete! Score: ${res.overall_score}% (${res.score_tier})`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze ATS match.");
    } finally {
      setAtsAnalyzing(false);
    }
  };

  // 1-Click Add Missing Skill from ATS recommendations
  const handleAddMissingSkill = (skill: string) => {
    const current = content.skills || [];
    if (!current.map((s) => s.toLowerCase()).includes(skill.toLowerCase())) {
      const updated = [...current, skill];
      setContent({ ...content, skills: updated });
      setSuccessMsg(`Added "${skill}" to skills! Save or re-run ATS check to verify new score.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  // AI Bullet Assistant
  const handleAiImproveBullet = async (type: string, currentText: string, instruction: string, expIdx?: number, bulletIdx?: number) => {
    if (!currentText) return;
    setImprovingIndex({ type, expIdx, bulletIdx });
    setAiLoading(true);
    setAiSuggestion(null);

    try {
      const res = await aiImproveBullet(type, currentText, instruction);
      setAiSuggestion({
        text: res.improved_text,
        explanation: res.explanation,
      });
    } catch (err: any) {
      console.error("AI improve error", err);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion || !improvingIndex) return;

    if (improvingIndex.type === "summary") {
      setContent((prev) => ({ ...prev, summary: aiSuggestion.text }));
    } else if (improvingIndex.type === "bullet" && improvingIndex.expIdx !== undefined && improvingIndex.bulletIdx !== undefined) {
      const { expIdx, bulletIdx } = improvingIndex;
      setContent((prev) => {
        const updatedExp = [...prev.experience];
        const bullets = [...(updatedExp[expIdx].achievements || [])];
        bullets[bulletIdx] = aiSuggestion.text;
        updatedExp[expIdx] = { ...updatedExp[expIdx], achievements: bullets };
        return { ...prev, experience: updatedExp };
      });
    }

    setAiSuggestion(null);
    setImprovingIndex(null);
  };

  const handleDownloadHtml = () => {
    if (!htmlPreview) return;
    const blob = new Blob([htmlPreview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_") || "resume"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDocx = async () => {
    if (!resumeId) return;
    try {
      setExportingDocx(true);
      const safeTitle = title.replace(/\s+/g, "_") || "Resume";
      await downloadResumeDocx(resumeId, `${safeTitle}.docx`);
      setSuccessMsg("Word document (.docx) exported successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to download Word document.");
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportPDF = () => {
    const iframe = document.getElementById("ats-resume-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleDeleteResume = async () => {
    if (!resumeId) return;
    try {
      setDeleting(true);
      await deleteResume(resumeId);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete resume.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#16A34A";
    if (score >= 75) return "#2563EB";
    if (score >= 50) return "#F59E0B";
    return "#EF4444";
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#7C3AED", marginBottom: "8px" }}>PrepCV Resume Workspace</div>
            <div style={{ fontSize: "14px", color: "#64748B" }}>Loading resume canvas & ATS engine...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="resume-editor-container" style={{ minHeight: "100vh", backgroundColor: "#F1F5F9", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
        
        {/* Top Header Bar */}
        <header className="no-print" style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          {/* Left: Back Link & Title & Version Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ background: "none", border: "none", color: "#64748B", fontSize: "13.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
            >
              ← Back
            </button>

            <div style={{ height: "20px", width: "1px", backgroundColor: "#E2E8F0" }} />

            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#0F172A",
                  border: "1px solid transparent",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  backgroundColor: "transparent",
                  outline: "none",
                  maxWidth: "200px",
                  width: "100%",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CBD5E1")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>

            {/* Version Badge Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                onClick={() => setActiveTab("versions")}
                style={{
                  backgroundColor: "#EFF6FF",
                  color: "#2563EB",
                  border: "1px solid #BFDBFE",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Click to view Version History"
              >
                <span>v{activeVersionNum}</span>
                <span style={{ fontSize: "10px" }}>▼</span>
              </span>
            </div>
          </div>

          {/* Center: Connected Workspace Mode Tabs */}
          <div style={{ display: "flex", backgroundColor: "#F1F5F9", padding: "4px", borderRadius: "8px", gap: "4px", overflowX: "auto" }}>
            <button
              onClick={() => setActiveTab("editor")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: activeTab === "editor" ? "#FFFFFF" : "transparent",
                color: activeTab === "editor" ? "#0F172A" : "#64748B",
                boxShadow: activeTab === "editor" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Edit3 size={15} />
              <span>Resume Editor</span>
            </button>

            <button
              onClick={() => setActiveTab("ats")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: activeTab === "ats" ? "#FFFFFF" : "transparent",
                color: activeTab === "ats" ? "#2563EB" : "#64748B",
                boxShadow: activeTab === "ats" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Target size={15} />
              <span>ATS Match {atsScoreResult ? `(${atsScoreResult.overall_score}%)` : "Checker"}</span>
            </button>

            <button
              onClick={() => setActiveTab("versions")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: activeTab === "versions" ? "#FFFFFF" : "transparent",
                color: activeTab === "versions" ? "#7C3AED" : "#64748B",
                boxShadow: activeTab === "versions" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <History size={15} />
              <span>Versions & Diff ({versions.length})</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "7px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Save size={14} />
              <span>{saving ? "Saving..." : "Save"}</span>
            </button>

            <button
              onClick={() => setShowSaveVersionModal(true)}
              style={{
                backgroundColor: "#7C3AED",
                color: "#FFFFFF",
                border: "none",
                padding: "7px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Plus size={14} />
              <span className="hide-on-mobile">Save as</span> New Version
            </button>

            <div style={{ height: "20px", width: "1px", backgroundColor: "#E2E8F0", margin: "0 2px" }} />

            <button
              onClick={handleExportDocx}
              disabled={exportingDocx}
              style={{
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
                border: "none",
                padding: "7px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: exportingDocx ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileText size={14} />
              <span>{exportingDocx ? "..." : "Word"}</span>
            </button>

            <button
              onClick={handleExportPDF}
              style={{
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                padding: "7px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileDown size={14} />
              <span>PDF</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete this resume"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
                padding: "7px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Trash2 size={14} />
              <span className="hide-on-mobile">Delete</span>
            </button>
          </div>
        </header>

        {/* Notifications */}
        {errorMsg && (
          <div className="no-print" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", padding: "10px 24px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="no-print" style={{ backgroundColor: "#F0FDF4", color: "#16A34A", padding: "10px 24px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: RESUME EDITOR & LIVE CANVAS */}
        {activeTab === "editor" && (
          <div style={{ display: "flex", flex: 1, flexWrap: "wrap", overflow: "auto" }}>
            {/* Left Editor Pane */}
            <div className="no-print" style={{
              flex: "1 1 380px",
              maxWidth: "100%",
              backgroundColor: "#FFFFFF",
              borderRight: "1px solid #E2E8F0",
              padding: "20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              {/* ATS Quick Banner */}
              {atsScoreResult && (
                <div style={{ padding: "12px 14px", borderRadius: "8px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "#2563EB", fontWeight: 700 }}>ATS Compatibility: </span>
                    <strong style={{ fontSize: "14px", color: getScoreColor(atsScoreResult.overall_score) }}>{atsScoreResult.overall_score}%</strong>
                    <span style={{ fontSize: "12px", color: "#64748B" }}> ({atsScoreResult.score_tier})</span>
                  </div>
                  <button onClick={() => setActiveTab("ats")} style={{ fontSize: "12px", color: "#2563EB", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    View Gaps →
                  </button>
                </div>
              )}

              {/* Summary Section */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>Executive Summary</span>
                  <button
                    onClick={() => handleAiImproveBullet("summary", content.summary, "Make punchy, executive-level, and tailored for impact")}
                    style={{ fontSize: "12px", color: "#7C3AED", backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Sparkles size={13} />
                    <span>AI Improve</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={content.summary}
                  onChange={(e) => setContent({ ...content, summary: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>

              {/* Work Experience Section */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "12px" }}>
                  Experience Bullets & Impact
                </span>
                {content.experience?.map((exp, expIdx) => (
                  <div key={expIdx} style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#2563EB", marginBottom: "6px" }}>
                      {exp.position} @ {exp.company}
                    </div>
                    {exp.achievements?.map((bullet, bulletIdx) => (
                      <div key={bulletIdx} style={{ marginTop: "8px" }}>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) => {
                              const updated = [...content.experience];
                              const b = [...updated[expIdx].achievements];
                              b[bulletIdx] = e.target.value;
                              updated[expIdx] = { ...updated[expIdx], achievements: b };
                              setContent({ ...content, experience: updated });
                            }}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                          />
                          <button
                            onClick={() => handleAiImproveBullet("bullet", bullet, "Add quantifiable metrics and high-impact action verbs", expIdx, bulletIdx)}
                            style={{ fontSize: "11px", color: "#7C3AED", backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE", padding: "0 8px", borderRadius: "4px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          >
                            <Sparkles size={12} />
                            <span>Improve</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Technical Skills Section */}
              <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                    Skills ({content.skills?.length || 0})
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {content.skills?.map((skill, sIdx) => (
                    <span key={sIdx} style={{ backgroundColor: "#F1F5F9", color: "#334155", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {skill}
                      <button
                        onClick={() => {
                          const updated = content.skills.filter((_, i) => i !== sIdx);
                          setContent({ ...content, skills: updated });
                        }}
                        style={{ border: "none", background: "none", color: "#94A3B8", cursor: "pointer", fontSize: "12px", padding: 0, display: "inline-flex", alignItems: "center" }}
                        title="Remove skill"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new skill inline input */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    id="new-skill-input"
                    type="text"
                    placeholder="Add a new skill (e.g. Kubernetes)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          handleAddMissingSkill(val);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("new-skill-input") as HTMLInputElement;
                      if (input && input.value.trim()) {
                        handleAddMissingSkill(input.value.trim());
                        input.value = "";
                      }
                    }}
                    style={{ padding: "6px 12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Live ATS Document Canvas */}
            <div style={{ flex: "1 1 450px", minWidth: 0, padding: "16px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
              {htmlPreview ? (
                <div style={{ width: "100%", maxWidth: "850px", minHeight: "297mm", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "4px", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                  <iframe
                    id="ats-resume-iframe"
                    srcDoc={htmlPreview}
                    title="Dynamic ATS Resume"
                    style={{ width: "100%", height: "100%", minHeight: "297mm", border: "none", display: "block", backgroundColor: "#FFFFFF" }}
                  />
                </div>
              ) : (
                <div className="ats-resume-paper" style={{ width: "100%", maxWidth: "850px", minHeight: "297mm", backgroundColor: "#FFFFFF", color: "#0f172a", padding: "24px 28px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "4px", lineHeight: 1.4, fontSize: "13.5px" }}>
                  {/* ATS Resume Header */}
                  <header style={{ textAlign: "center", marginBottom: "16px" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>
                      {content.personal_info?.full_name || title}
                    </h1>
                    {content.personal_info?.professional_title && (
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "#334155", marginBottom: "6px" }}>
                        {content.personal_info.professional_title}
                      </div>
                    )}
                    <div style={{ fontSize: "12.5px", color: "#64748b", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px 10px" }}>
                      {content.personal_info?.phone && <span>{content.personal_info.phone}</span>}
                      {content.personal_info?.email && <span>• {content.personal_info.email}</span>}
                      {content.personal_info?.location && <span>• {content.personal_info.location}</span>}
                      {content.personal_info?.linkedin_url && <span>• {formatDisplayUrl(content.personal_info.linkedin_url)}</span>}
                      {content.personal_info?.github_url && <span>• {formatDisplayUrl(content.personal_info.github_url)}</span>}
                    </div>
                  </header>

                  {/* Summary */}
                  {content.summary && (
                    <section style={{ marginTop: "14px" }}>
                      <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1.5px solid #0f172a", paddingBottom: "3px", margin: "0 0 8px 0" }}>Summary</h2>
                      <p style={{ margin: 0, lineHeight: 1.42, textAlign: "justify" }}>{content.summary}</p>
                    </section>
                  )}

                  {/* Experience */}
                  {content.experience && content.experience.length > 0 && (
                    <section style={{ marginTop: "14px" }}>
                      <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1.5px solid #0f172a", paddingBottom: "3px", margin: "0 0 8px 0" }}>Experience</h2>
                      {content.experience.map((exp, idx) => (
                        <div key={idx} style={{ marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong>{exp.position}</strong>
                            <span>{exp.start_date} — {exp.end_date || "Present"}</span>
                          </div>
                          <div style={{ fontStyle: "italic", fontSize: "12.5px" }}>{exp.company}</div>
                          {exp.achievements && (
                            <ul style={{ margin: "3px 0 0 0", paddingLeft: "1.25rem" }}>
                              {exp.achievements.map((b, bIdx) => (
                                <li key={bIdx}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* Skills */}
                  {content.skills && content.skills.length > 0 && (
                    <section style={{ marginTop: "14px" }}>
                      <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", borderBottom: "1.5px solid #0f172a", paddingBottom: "3px", margin: "0 0 8px 0" }}>Skills</h2>
                      <div>{content.skills.join(", ")}</div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ATS MATCH CHECKER (STEP 5) */}
        {activeTab === "ats" && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Target size={20} color="#2563EB" />
                    <span>ATS Job Description Match Analyzer</span>
                  </h2>
                  <p style={{ fontSize: "13.5px", color: "#64748B", margin: 0 }}>
                    Score your working resume draft against the target job requirements and fix keyword gaps.
                  </p>
                </div>
                <button
                  onClick={() => setTargetJd(SAMPLE_JD)}
                  style={{ fontSize: "12.5px", color: "#7C3AED", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Sparkles size={13} />
                  <span>Load Example JD</span>
                </button>
              </div>

              <textarea
                value={targetJd}
                onChange={(e) => setTargetJd(e.target.value)}
                placeholder="Paste the target job description here..."
                rows={7}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13.5px", fontFamily: "inherit", boxSizing: "border-box", outline: "none", lineHeight: 1.5, marginBottom: "12px" }}
              />

              <button
                onClick={handleRunAtsCheck}
                disabled={atsAnalyzing || !targetJd.trim()}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: atsAnalyzing ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Zap size={16} />
                <span>{atsAnalyzing ? "Analyzing Match..." : atsScoreResult ? "Re-calculate ATS Score" : "Analyze ATS Match"}</span>
                {!atsAnalyzing && !atsScoreResult && <ArrowRight size={16} />}
              </button>
            </div>

            {/* ATS Score Results */}
            {atsScoreResult && (
              <div>
                {/* Hero Score Box */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "24px", alignItems: "center" }}>
                  <div style={{ textAlign: "center", borderRight: "1px solid #E2E8F0", paddingRight: "20px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>ATS MATCH</div>
                    <div style={{ fontSize: "52px", fontWeight: 900, color: getScoreColor(atsScoreResult.overall_score), lineHeight: 1.1 }}>
                      {atsScoreResult.overall_score}%
                    </div>
                    <div style={{ display: "inline-block", marginTop: "6px", padding: "3px 12px", borderRadius: "12px", backgroundColor: "#EFF6FF", color: getScoreColor(atsScoreResult.overall_score), fontSize: "12.5px", fontWeight: 700 }}>
                      {atsScoreResult.score_tier}
                    </div>
                    {atsScoreResult.score_change !== null && atsScoreResult.score_change !== undefined && (
                      <div style={{ marginTop: "8px", fontSize: "12px", fontWeight: 700, color: atsScoreResult.score_change >= 0 ? "#16A34A" : "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        {atsScoreResult.score_change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{atsScoreResult.score_change >= 0 ? `+${atsScoreResult.score_change} pts` : `${atsScoreResult.score_change} pts`}</span>
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "8px" }}>
                      {atsScoreResult.keyword_stats.matched_keywords_count} / {atsScoreResult.keyword_stats.total_jd_keywords_count} keywords found
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "#0F172A" }}>
                      {atsScoreResult.score_summary}
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "12px", marginTop: "16px" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Keyword Match</span>
                          <span>{atsScoreResult.breakdown.keyword_match}%</span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#F1F5F9", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ width: `${atsScoreResult.breakdown.keyword_match}%`, height: "100%", backgroundColor: getScoreColor(atsScoreResult.breakdown.keyword_match) }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          <span>Skills Match</span>
                          <span>{atsScoreResult.breakdown.skills_match}%</span>
                        </div>
                        <div style={{ height: "6px", backgroundColor: "#F1F5F9", borderRadius: "99px", overflow: "hidden" }}>
                          <div style={{ width: `${atsScoreResult.breakdown.skills_match}%`, height: "100%", backgroundColor: getScoreColor(atsScoreResult.breakdown.skills_match) }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Missing Keywords & Recommendations */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "24px", marginBottom: "24px" }}>
                  {/* Missing Keywords */}
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangle size={16} color="#DC2626" />
                      <span>Missing from Resume ({atsScoreResult.missing_keywords.length})</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {atsScoreResult.missing_keywords.map((kw, i) => (
                        <div key={i} style={{ padding: "10px 12px", borderRadius: "6px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#991B1B" }}>{kw.skill}</span>
                            <span style={{ fontSize: "11.5px", color: "#64748B", marginLeft: "6px" }}>Mentioned {kw.count_in_jd}× in JD</span>
                          </div>
                          <button
                            onClick={() => handleAddMissingSkill(kw.skill)}
                            style={{ padding: "4px 10px", borderRadius: "4px", border: "none", backgroundColor: "#16A34A", color: "#FFFFFF", fontSize: "11.5px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Plus size={12} />
                            <span>Add to Skills</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Matching Skills */}
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={16} color="#16A34A" />
                      <span>Matching Skills ({atsScoreResult.matching_skills.length})</span>
                    </h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {atsScoreResult.matching_skills.map((skill, i) => (
                        <span key={i} style={{ padding: "4px 10px", borderRadius: "16px", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", fontSize: "12.5px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Check size={12} />
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Concrete Suggestions */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Lightbulb size={18} color="#2563EB" />
                    <span>Actionable Recommendations</span>
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
                    {atsScoreResult.recommendations.map((rec, i) => (
                      <div key={i} style={{ padding: "14px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>{rec.title}</div>
                        <p style={{ fontSize: "12.5px", color: "#475569", margin: "0 0 10px 0" }}>{rec.description}</p>
                        {rec.action_type === "add_skill" && rec.target_text && (
                          <button
                            onClick={() => handleAddMissingSkill(rec.target_text!)}
                            style={{ padding: "4px 10px", backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", borderRadius: "4px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Plus size={12} />
                            <span>Add Skill</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VERSION HISTORY & DIFF (STEP 6) */}
        {activeTab === "versions" && (
          <div style={{ flex: 1, padding: "24px", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
            {/* Version List Timeline */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    <History size={20} color="#7C3AED" />
                    <span>Version History</span>
                  </h2>
                  <p style={{ fontSize: "13.5px", color: "#64748B", margin: 0 }}>
                    Every meaningful update is archived. Restoring an older version creates a new increment without deleting history.
                  </p>
                </div>
                <button
                  onClick={() => setShowSaveVersionModal(true)}
                  style={{ padding: "8px 16px", backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={14} />
                  <span>Save New Version</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {versions.map((v) => {
                  const isCurrent = v.version_number === activeVersionNum;
                  return (
                    <div
                      key={v.id}
                      style={{
                        padding: "16px",
                        borderRadius: "8px",
                        backgroundColor: isCurrent ? "#F8FAFC" : "#FFFFFF",
                        border: `1px solid ${isCurrent ? "#2563EB" : "#E2E8F0"}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: isCurrent ? "#2563EB" : "#E2E8F0", color: isCurrent ? "#FFFFFF" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "13px" }}>
                          v{v.version_number}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "14px", color: "#0F172A" }}>{v.title}</strong>
                            {isCurrent && (
                              <span style={{ backgroundColor: "#EFF6FF", color: "#2563EB", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                                Current Active
                              </span>
                            )}
                            {v.ats_score && (
                              <span style={{ backgroundColor: "#F0FDF4", color: "#16A34A", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                                {v.ats_score}% ATS
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12.5px", color: "#64748B", marginTop: "2px" }}>
                            "{v.change_summary}" • Saved on {new Date(v.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        {!isCurrent && (
                          <button
                            onClick={() => setRestoreConfirmVersion(v)}
                            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", color: "#2563EB", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <RotateCcw size={13} />
                            <span>Restore Version</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Version Diff & Compare Section */}
            {versions.length >= 2 && (
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Split size={18} color="#2563EB" />
                  <span>Side-by-Side Version Diff & Score Comparison</span>
                </h3>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "4px" }}>Base Version (Older)</label>
                    <select
                      value={diffBaseId}
                      onChange={(e) => setDiffBaseId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          Version {v.version_number} — {v.change_summary} ({new Date(v.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: "18px", color: "#94A3B8", marginTop: "16px" }}>→</div>

                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "4px" }}>Compared Version (Newer)</label>
                    <select
                      value={diffComparedId}
                      onChange={(e) => setDiffComparedId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          Version {v.version_number} — {v.change_summary} ({new Date(v.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleRunDiff}
                    disabled={loadingDiff || !diffBaseId || !diffComparedId}
                    style={{ marginTop: "18px", padding: "9px 18px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Split size={14} />
                    <span>{loadingDiff ? "Comparing..." : "Compare Diffs"}</span>
                  </button>
                </div>

                {/* Diff Results Output */}
                {diffResult && (
                  <div style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", padding: "16px" }}>
                    {/* Score Diff Banner */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #E2E8F0", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                        Score Evolution: v{diffResult.base_version.version_number} ({diffResult.base_version.ats_score || "N/A"}%) → v{diffResult.compared_version.version_number} ({diffResult.compared_version.ats_score || "N/A"}%)
                      </span>
                      {diffResult.diff.ats_score?.score_diff !== null && diffResult.diff.ats_score?.score_diff !== undefined && (
                        <span style={{ fontSize: "13px", fontWeight: 700, color: diffResult.diff.ats_score.score_diff >= 0 ? "#16A34A" : "#EF4444", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {diffResult.diff.ats_score.score_diff >= 0 ? (
                            <>
                              <TrendingUp size={14} />
                              <span>+{diffResult.diff.ats_score.score_diff} pts improvement</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown size={14} />
                              <span>{diffResult.diff.ats_score.score_diff} pts</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Added Skills Diff */}
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#16A34A" }}>Skills Added (+): </span>
                      {diffResult.diff.skills.added.length > 0 ? (
                        <span style={{ fontSize: "12.5px", color: "#15803D" }}>{diffResult.diff.skills.added.join(", ")}</span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94A3B8" }}>None</span>
                      )}
                    </div>

                    {/* Removed Skills Diff */}
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#DC2626" }}>Skills Removed (-): </span>
                      {diffResult.diff.skills.removed.length > 0 ? (
                        <span style={{ fontSize: "12.5px", color: "#B91C1C" }}>{diffResult.diff.skills.removed.join(", ")}</span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94A3B8" }}>None</span>
                      )}
                    </div>

                    {/* Summary changed */}
                    <div style={{ fontSize: "12.5px", color: "#475569" }}>
                      Executive Summary: <strong>{diffResult.diff.summary.changed ? "Modified in newer version" : "Unchanged"}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal: Save as New Version */}
        {showSaveVersionModal && (
          <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="responsive-modal-card" style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0" }}>
                Save as Version {activeVersionNum + 1}
              </h3>
              <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0" }}>
                Add a short note describing what you updated (e.g. "Added Kubernetes experience and fixed ATS keyword gaps"):
              </p>

              <input
                type="text"
                value={versionChangeNote}
                onChange={(e) => setVersionChangeNote(e.target.value)}
                placeholder="e.g. Added CI/CD and Docker experience"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13.5px", boxSizing: "border-box", marginBottom: "20px" }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => setShowSaveVersionModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewVersion}
                  disabled={savingNewVersion}
                  style={{ padding: "8px 20px", borderRadius: "6px", border: "none", backgroundColor: "#7C3AED", color: "#FFFFFF", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                >
                  {savingNewVersion ? "Saving..." : "Create Version"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Restore Version Confirmation */}
        {restoreConfirmVersion && (
          <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="responsive-modal-card" style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>
                Restore Version {restoreConfirmVersion.version_number}?
              </h3>
              <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                This will create a brand-new version increment based on <strong>Version {restoreConfirmVersion.version_number}</strong>. Your current Version {activeVersionNum} will remain safe in history.
              </p>
              <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "6px", fontSize: "12.5px", color: "#64748B", marginBottom: "20px" }}>
                Note: "{restoreConfirmVersion.change_summary}" ({new Date(restoreConfirmVersion.created_at).toLocaleDateString()})
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => setRestoreConfirmVersion(null)}
                  style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreVersion}
                  disabled={restoringVersion}
                  style={{ padding: "8px 20px", borderRadius: "6px", border: "none", backgroundColor: "#2563EB", color: "#FFFFFF", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                >
                  {restoringVersion ? "Restoring..." : "Confirm & Restore"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Suggestion Modal */}
        {aiSuggestion && (
          <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div className="responsive-modal-card" style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "24px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#7C3AED", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={18} />
                <span>AI Improvement Suggestion</span>
              </div>
              <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", padding: "14px", borderRadius: "8px", fontSize: "14px", color: "#0F172A", marginBottom: "12px", lineHeight: 1.5 }}>
                "{aiSuggestion.text}"
              </div>
              {aiSuggestion.explanation && (
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Lightbulb size={14} color="#D97706" />
                  <span>{aiSuggestion.explanation}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  onClick={() => setAiSuggestion(null)}
                  style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", cursor: "pointer", fontSize: "13px" }}
                >
                  Dismiss
                </button>
                <button
                  onClick={applyAiSuggestion}
                  style={{ padding: "8px 20px", borderRadius: "6px", border: "none", backgroundColor: "#7C3AED", color: "#FFFFFF", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                >
                  Apply Suggestion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Resume Confirmation Modal */}
        {showDeleteModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div style={{ padding: "8px", borderRadius: "50%", backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                  <Trash2 size={20} />
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Delete Resume?
                </h3>
              </div>
              <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                Are you sure you want to delete <strong>"{title}"</strong>? This will permanently delete this resume and all its version history.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteResume}
                  disabled={deleting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: deleting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {deleting ? "Deleting..." : "Delete Resume"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Print Media Rules */}
        <style jsx global>{`
          @page {
            size: A4 portrait;
            margin: 8mm 10mm !important;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            .resume-editor-container {
              min-height: auto !important;
              background-color: #ffffff !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .ats-resume-paper {
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
