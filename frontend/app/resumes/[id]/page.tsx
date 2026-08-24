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

  const [title, setTitle] = useState<string>("ATS Optimized Resume");
  const [content, setContent] = useState<ResumeContent>({
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

  useEffect(() => {
    async function loadResume() {
      if (!resumeId) return;
      try {
        setLoading(true);
        const data = await fetchResumeById(resumeId);
        setTitle(data.title || "ATS Optimized Resume");
        if (data.content) {
          setContent({
            summary: data.content.summary || "",
            experience: data.content.experience || [],
            education: data.content.education || [],
            skills: data.content.skills || [],
            projects: data.content.projects || [],
            certifications: data.content.certifications || [],
          });
        }
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
      setSuccessMsg("Resume saved successfully!");
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

  const handleExportPDF = () => {
    window.print();
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

  const personalInfo = content.summary ? {
    full_name: title.replace("'s Resume", ""),
  } : {};

  return (
    <ProtectedRoute>
      <div className="resume-editor-container" style={{ minHeight: "100vh", backgroundColor: "#F1F5F9", display: "flex", flexDirection: "column" }}>
        
        {/* Top Header Bar */}
        <header className="no-print" style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => router.push("/profile")}
              style={{ background: "none", border: "1px solid #CBD5E1", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", color: "#475569" }}
            >
              ← Profile
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", border: "1px solid transparent", padding: "4px 8px", borderRadius: "6px" }}
              onFocus={(e) => e.target.style.borderColor = "#CBD5E1"}
              onBlur={(e) => e.target.style.borderColor = "transparent"}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* ATS Readiness Badge */}
            <button
              onClick={() => setShowAtsModal(true)}
              style={{
                backgroundColor: "#F0FDF4",
                color: "#16A34A",
                border: "1px solid #BBF7D0",
                padding: "6px 14px",
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
              onClick={handleExportPDF}
              style={{
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Export PDF ↓
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
          <div style={{ flex: 1, padding: "32px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
            
            <div className="ats-resume-paper" style={{
              width: "210mm",
              minHeight: "297mm",
              backgroundColor: "#FFFFFF",
              color: "#0F172A",
              fontFamily: "Inter, Arial, sans-serif",
              padding: "40px 48px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              borderRadius: "2px",
              lineHeight: 1.5
            }}>
              
              {/* ATS Resume Header (Name & Contact Details - Pure Single Column Flow) */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #0F172A", paddingBottom: "16px", marginBottom: "20px" }}>
                <h1 style={{ fontSize: "26px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px 0", color: "#0F172A" }}>
                  {title.replace("'s Resume", "").replace("Resume", "").trim() || "CANDIDATE NAME"}
                </h1>
                <div style={{ fontSize: "13px", color: "#334155", fontWeight: 500 }}>
                  Email: user@example.com | Phone: +92 311 XXXXXXX | Location: Lahore, Pakistan
                </div>
                <div style={{ fontSize: "13px", color: "#2563EB", marginTop: "4px" }}>
                  LinkedIn: linkedin.com/in/candidate | Portfolio: github.com/candidate
                </div>
              </div>

              {/* Professional Summary */}
              {content.summary && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "8px" }}>
                    Professional Summary
                  </h2>
                  <p style={{ fontSize: "13px", color: "#334155", margin: 0, textAlign: "justify" }}>
                    {content.summary}
                  </p>
                </div>
              )}

              {/* Work Experience */}
              {content.experience && content.experience.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "12px" }}>
                    Work Experience
                  </h2>
                  {content.experience.map((exp, idx) => (
                    <div key={idx} style={{ marginBottom: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <strong style={{ fontSize: "14px", color: "#0F172A" }}>{exp.position}</strong>
                        <span style={{ fontSize: "12px", color: "#475569", fontWeight: 600 }}>
                          {exp.start_date ? `From ${exp.start_date} to ${exp.end_date || (exp.is_current ? "Present" : "Present")}` : (exp.end_date || "Present")}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#475569", fontStyle: "italic", marginBottom: "6px" }}>
                        {exp.company} {exp.location ? `• ${exp.location}` : ""}
                      </div>
                      {exp.achievements && exp.achievements.length > 0 && (
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "13px", color: "#334155" }}>
                          {exp.achievements.map((bullet, bIdx) => (
                            <li key={bIdx} style={{ marginBottom: "4px" }}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Technical Skills */}
              {content.skills && content.skills.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "8px" }}>
                    Skills & Competencies
                  </h2>
                  <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
                    <strong>Technical Stack: </strong> {content.skills.join(" • ")}
                  </div>
                </div>
              )}

              {/* Education */}
              {content.education && content.education.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "10px" }}>
                    Education
                  </h2>
                  {content.education.map((edu, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div>
                        <strong style={{ fontSize: "13px", color: "#0F172A" }}>{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}</strong>
                        <div style={{ fontSize: "12px", color: "#475569" }}>{edu.institution}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569", fontWeight: 600 }}>
                        {edu.start_date ? `From ${edu.start_date} to ${edu.end_date || "Present"}` : edu.end_date}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects */}
              {content.projects && content.projects.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "10px" }}>
                    Projects
                  </h2>
                  {content.projects.map((proj, idx) => (
                    <div key={idx} style={{ marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#0F172A" }}>{proj.name}</strong>
                      {proj.technologies?.length ? <span style={{ fontSize: "12px", color: "#475569" }}> ({proj.technologies.join(", ")})</span> : null}
                      <p style={{ fontSize: "13px", color: "#334155", margin: "2px 0 0 0" }}>{proj.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Certifications (Optional) */}
              {content.certifications && content.certifications.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#0F172A", borderBottom: "1px solid #CBD5E1", paddingBottom: "4px", marginBottom: "10px" }}>
                    Certifications
                  </h2>
                  {content.certifications.map((cert, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                      <div>
                        <strong>{cert.name}</strong> — <span style={{ color: "#475569" }}>{cert.issuing_organization}</span>
                      </div>
                      {cert.issue_date && <span style={{ fontSize: "12px", color: "#475569", fontWeight: 600 }}>{cert.issue_date}</span>}
                    </div>
                  ))}
                </div>
              )}

            </div>

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
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .resume-editor-container {
              min-height: auto !important;
              background-color: #ffffff !important;
            }
            .ats-resume-paper {
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
