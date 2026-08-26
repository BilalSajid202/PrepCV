"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import {
  ResumeData,
  ResumeContent,
  fetchResumeById,
  updateResumeContent,
  aiImproveBullet,
  fetchResumeHtml,
  fetchPreviewHtml,
  downloadResumeDocx,
} from "@/lib/api";

export default function ResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const resumeId = params?.id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showAtsModal, setShowAtsModal] = useState<boolean>(false);
  const [htmlPreview, setHtmlPreview] = useState<string>("");

  const [title, setTitle] = useState<string>("ATS Optimized Resume");
  const [content, setContent] = useState<ResumeContent>({
    personal_info: {},
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  });

  // AI Improvement Modal / Suggestion state
  const [improvingIndex, setImprovingIndex] = useState<{ type: string; expIdx?: number; bulletIdx?: number } | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ text: string; explanation?: string } | null>(null);

  const loadHtmlPreview = async (id: string, currentContent?: ResumeContent) => {
    try {
      const html = await fetchResumeHtml(id);
      setHtmlPreview(html);
    } catch (err) {
      console.warn("Fetching HTML via ID failed, falling back to direct render:", err);
      if (currentContent) {
        try {
          const previewHtml = await fetchPreviewHtml(currentContent);
          setHtmlPreview(previewHtml);
        } catch (pErr) {
          console.warn("Could not render in-memory preview:", pErr);
        }
      }
    }
  };

  useEffect(() => {
    async function loadResume() {
      if (!resumeId) return;
      try {
        setLoading(true);
        const data = await fetchResumeById(resumeId);
        setTitle(data.title || "ATS Optimized Resume");
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
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load resume.");
      } finally {
        setLoading(false);
      }
    }
    loadResume();
  }, [resumeId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg(null);
      await updateResumeContent(resumeId, title, content);
      await loadHtmlPreview(resumeId, content);
      setSuccessMsg("Resume and dynamic HTML updated successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save resume.");
    } finally {
      setSaving(false);
    }
  };

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

  const [exportingDocx, setExportingDocx] = useState<boolean>(false);

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
    // If iframe exists, focus and print it, else window.print()
    const iframe = document.getElementById("ats-resume-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#7C3AED", marginBottom: "8px" }}>PrepCV Resume Editor</div>
            <div style={{ fontSize: "14px", color: "#64748B" }}>Preparing ATS resume canvas...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="resume-editor-container" style={{ minHeight: "100vh", backgroundColor: "#F1F5F9", display: "flex", flexDirection: "column" }}>
        
        {/* Top Header Bar */}
        <header className="no-print" style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ background: "none", border: "none", color: "#64748B", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}
            >
              ← Back to Dashboard
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#0F172A",
                border: "1px solid transparent",
                borderRadius: "4px",
                padding: "2px 6px",
                backgroundColor: "transparent",
                outline: "none"
              }}
              onFocus={(e) => e.target.style.borderColor = "#CBD5E1"}
              onBlur={(e) => e.target.style.borderColor = "transparent"}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setShowAtsModal(true)}
              style={{
                backgroundColor: "#F0FDF4",
                color: "#16A34A",
                border: "1px solid #BBF7D0",
                padding: "8px 14px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16A34A", display: "inline-block" }}></span>
              ATS Ready ✓
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={handleDownloadHtml}
              style={{
                backgroundColor: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              📄 HTML
            </button>

            <button
              onClick={handleExportDocx}
              disabled={exportingDocx}
              style={{
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: exportingDocx ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {exportingDocx ? "Exporting..." : "📝 Export Word (.docx)"}
            </button>

            <button
              onClick={handleExportPDF}
              style={{
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              📑 Export PDF
            </button>
          </div>
        </header>

        {/* Notifications */}
        {errorMsg && (
          <div className="no-print" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", padding: "10px 24px", fontSize: "14px" }}>
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="no-print" style={{ backgroundColor: "#F0FDF4", color: "#16A34A", padding: "10px 24px", fontSize: "14px" }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Main Split Pane Layout */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          
          {/* Left Editor Pane */}
          <div className="no-print" style={{
            width: "450px",
            backgroundColor: "#FFFFFF",
            borderRight: "1px solid #E2E8F0",
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Content & AI Assist Editor
            </h2>

            {/* Summary Section */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>Executive Summary</span>
                <button
                  onClick={() => handleAiImproveBullet("summary", content.summary, "Make punchy and executive level")}
                  style={{ fontSize: "12px", color: "#7C3AED", backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }}
                >
                  ✨ Improve
                </button>
              </div>
              <textarea
                rows={4}
                value={content.summary}
                onChange={(e) => setContent({ ...content, summary: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            {/* Work Experience Section */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "12px" }}>
                Experience Bullets & Impact
              </span>
              {content.experience?.map((exp, expIdx) => (
                <div key={expIdx} style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#2563EB" }}>
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
                          onClick={() => handleAiImproveBullet("bullet", bullet, "Add measurable impact and strong action verb", expIdx, bulletIdx)}
                          style={{ fontSize: "11px", color: "#7C3AED", backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE", padding: "0 8px", borderRadius: "4px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          ✨ Improve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Skills Section */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                Skills ({content.skills?.length || 0})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {content.skills?.map((skill, sIdx) => (
                  <span key={sIdx} style={{ backgroundColor: "#F1F5F9", color: "#334155", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 500 }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

          </div>

          {/* Right Live ATS Document Preview */}
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
            
            {htmlPreview ? (
              <div style={{ width: "100%", maxWidth: "850px", minHeight: "297mm", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", borderRadius: "4px", overflow: "hidden", backgroundColor: "#FFFFFF" }}>
                <iframe
                  id="ats-resume-iframe"
                  srcDoc={htmlPreview}
                  title="Dynamic ATS Resume"
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "297mm",
                    border: "none",
                    display: "block",
                    backgroundColor: "#FFFFFF"
                  }}
                />
              </div>
            ) : (
              <div className="ats-resume-paper" style={{
                width: "100%",
                maxWidth: "850px",
                minHeight: "297mm",
                backgroundColor: "#FFFFFF",
                color: "#1a1a1a",
                fontFamily: '"Georgia", "Times New Roman", Times, serif',
                padding: "24px 32px 30px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                borderRadius: "4px",
                lineHeight: 1.45,
                fontSize: "14px"
              }}>
                
                {/* ATS Resume Header */}
                <header style={{ textAlign: "center", marginBottom: "14px" }}>
                  <h1 style={{ fontSize: "28px", fontWeight: "bold", letterSpacing: "0.5px", margin: "0 0 4px 0", color: "#1a1a1a" }}>
                    {content.personal_info?.full_name || (title && !title.includes("ATS") ? title.replace("'s Resume", "") : "Candidate Name")}
                  </h1>
                  {content.personal_info?.professional_title && (
                    <div style={{ fontSize: "14.5px", color: "#333333", marginBottom: "6px" }}>
                      {content.personal_info.professional_title}
                    </div>
                  )}
                  <div style={{ fontSize: "13px", color: "#333333", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    {content.personal_info?.phone && (
                      <span><a href={`tel:${content.personal_info.phone}`} style={{ color: "#0b5cab", textDecoration: "none" }}>{content.personal_info.phone}</a></span>
                    )}
                    {content.personal_info?.phone && content.personal_info?.email && <span>&#9671;</span>}
                    {content.personal_info?.email && (
                      <span><a href={`mailto:${content.personal_info.email}`} style={{ color: "#0b5cab", textDecoration: "none" }}>{content.personal_info.email}</a></span>
                    )}
                    {content.personal_info?.email && content.personal_info?.location && <span>&#9671;</span>}
                    {content.personal_info?.location && <span>{content.personal_info.location}</span>}
                    {content.personal_info?.location && content.personal_info?.linkedin_url && <span>&#9671;</span>}
                    {content.personal_info?.linkedin_url && (
                      <span><a href={content.personal_info.linkedin_url.startsWith("http") ? content.personal_info.linkedin_url : `https://${content.personal_info.linkedin_url}`} target="_blank" rel="noreferrer" style={{ color: "#0b5cab", textDecoration: "none" }}>LinkedIn</a></span>
                    )}
                    {content.personal_info?.linkedin_url && content.personal_info?.github_url && <span>&#9671;</span>}
                    {content.personal_info?.github_url && (
                      <span><a href={content.personal_info.github_url.startsWith("http") ? content.personal_info.github_url : `https://${content.personal_info.github_url}`} target="_blank" rel="noreferrer" style={{ color: "#0b5cab", textDecoration: "none" }}>GitHub</a></span>
                    )}
                    {content.personal_info?.github_url && content.personal_info?.portfolio_url && <span>&#9671;</span>}
                    {content.personal_info?.portfolio_url && (
                      <span><a href={content.personal_info.portfolio_url.startsWith("http") ? content.personal_info.portfolio_url : `https://${content.personal_info.portfolio_url}`} target="_blank" rel="noreferrer" style={{ color: "#0b5cab", textDecoration: "none" }}>Portfolio</a></span>
                    )}
                  </div>
                </header>

                {/* Professional Summary */}
                {content.summary && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Summary
                    </h2>
                    <p style={{ margin: 0, textAlign: "justify" }}>
                      {content.summary}
                    </p>
                  </section>
                )}

                {/* Work Experience */}
                {content.experience && content.experience.length > 0 && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Experience
                    </h2>
                    {content.experience.map((exp, idx) => (
                      <div key={idx} style={{ marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "14px" }}>{exp.position}</strong>
                          <span style={{ fontSize: "13px", fontStyle: "italic", color: "#333333", whiteSpace: "nowrap" }}>
                            {exp.start_date ? `${exp.start_date} — ${exp.end_date || (exp.is_current ? "Present" : "Present")}` : (exp.end_date || "Present")}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontStyle: "italic", color: "#333333", marginBottom: "3px" }}>
                          <span>{exp.company}</span>
                          {exp.location && <span>{exp.location}</span>}
                        </div>
                        {exp.achievements && exp.achievements.length > 0 && (
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                            {exp.achievements.map((bullet, bIdx) => (
                              <li key={bIdx} style={{ marginBottom: "3px" }}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {/* Projects */}
                {content.projects && content.projects.length > 0 && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Projects
                    </h2>
                    {content.projects.map((proj, idx) => {
                      const validBullets = (proj.achievements || []).filter(
                        (b) => b && b.trim() !== "" && b.trim() !== "•" && b.trim() !== "-"
                      );
                      return (
                        <div key={idx} style={{ marginBottom: "10px" }}>
                          <strong style={{ fontSize: "14px", display: "block", marginBottom: "2px" }}>{proj.name}</strong>
                          {proj.description && <p style={{ margin: 0, textAlign: "justify" }}>{proj.description}</p>}
                          {validBullets.length > 0 && (
                            <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                              {validBullets.map((bullet, bIdx) => (
                                <li key={bIdx} style={{ marginBottom: "3px" }}>{bullet.trim()}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}

                {/* Technical Skills */}
                {content.skills && content.skills.length > 0 && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Skills
                    </h2>
                    <div style={{ lineHeight: 1.5 }}>
                      <strong>Technical Proficiencies —</strong> {content.skills.join(", ")}
                    </div>
                  </section>
                )}

                {/* Education */}
                {content.education && content.education.length > 0 && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Education
                    </h2>
                    {content.education.map((edu, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                        <div>
                          <strong>{edu.degree}</strong>{edu.field_of_study ? ` in ${edu.field_of_study}` : ""}{edu.institution ? `, ${edu.institution}` : ""}
                        </div>
                        <div style={{ textAlign: "right", fontSize: "13px", fontStyle: "italic", color: "#333333" }}>
                          {edu.start_date ? `${edu.start_date} — ${edu.end_date || "Present"}` : edu.end_date}
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {/* Certifications */}
                {content.certifications && content.certifications.length > 0 && (
                  <section style={{ marginTop: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", background: "#efefef", borderBottom: "1.5px solid #1a1a1a", padding: "2px 6px", margin: "0 0 8px 0" }}>
                      Certifications
                    </h2>
                    {content.certifications.map((cert, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                        <div>
                          <strong>{cert.name}</strong>{cert.issuing_organization ? ` — ${cert.issuing_organization}` : ""}
                        </div>
                        <div style={{ fontSize: "13px", color: "#333333" }}>
                          {cert.issue_date}{cert.expiration_date ? ` — ${cert.expiration_date}` : ""}
                        </div>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            )}

          </div>

        </div>

        {/* AI Suggestion Modal */}
        {aiSuggestion && (
          <div className="no-print" style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100
          }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "28px", maxWidth: "500px", width: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#7C3AED", marginBottom: "12px" }}>
                ✨ AI Improvement Suggestion
              </div>
              <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", padding: "14px", borderRadius: "8px", fontSize: "14px", color: "#0F172A", marginBottom: "12px", lineHeight: 1.5 }}>
                "{aiSuggestion.text}"
              </div>
              {aiSuggestion.explanation && (
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "20px" }}>
                  💡 {aiSuggestion.explanation}
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

        {/* ATS Readiness Modal */}
        {showAtsModal && (
          <div className="no-print" style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100
          }}>
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "28px", maxWidth: "480px", width: "90%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  ATS Safety Compliance
                </h3>
                <span style={{ backgroundColor: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
                  ATS Safe ✓
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
                This resume layout adheres strictly to standard Applicant Tracking System (ATS) parsing rules:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", color: "#0F172A", marginBottom: "24px" }}>
                <div>✓ Single-column linear layout</div>
                <div>✓ Standard uppercase section headings</div>
                <div>✓ Standard typography (Inter / Arial)</div>
                <div>✓ No embedded HTML tables for positioning</div>
                <div>✓ No floating text boxes or multi-column grids</div>
                <div>✓ No embedded image text</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => setShowAtsModal(false)}
                  style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 20px", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                >
                  Close
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
            @page {
              size: A4 portrait;
              margin: 8mm 10mm !important;
            }
            html, body {
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .resume-editor-container {
              min-height: auto !important;
              background-color: #ffffff !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            .ats-resume-paper {
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
