"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import { useAuth } from "@/lib/auth-context";
import {
  CandidateProfile,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  fetchProfile,
  saveProfile,
  uploadCVFile,
  formatProfileWithAI,
  generateResume,
} from "@/lib/api";

const SUGGESTED_SKILLS = [
  "Python", "FastAPI", "React", "TypeScript", "Next.js", "PostgreSQL",
  "RAG", "LLM", "PyTorch", "Docker", "AWS", "Git", "Machine Learning", "NLP"
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [formatting, setFormatting] = useState<boolean>(false);
  const [formatModalMode, setFormatModalMode] = useState<"upload" | "format">("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStepText, setUploadStepText] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Job Title Modal State
  const [showJobTitleModal, setShowJobTitleModal] = useState<boolean>(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [jobTitleInput, setJobTitleInput] = useState<string>("");
  const [extractedNotice, setExtractedNotice] = useState<boolean>(false);

  // Main Profile Form State
  const [profile, setProfile] = useState<CandidateProfile>({
    personal_info: {
      full_name: "",
      professional_title: "",
      email: "",
      phone: "",
      location: "",
      linkedin_url: "",
      github_url: "",
      portfolio_url: "",
      summary: "",
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  });

  // New skill input
  const [skillInput, setSkillInput] = useState<string>("");

  // Load existing profile from backend on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchProfile();
        setProfile((prev) => ({
          ...prev,
          personal_info: {
            ...prev.personal_info,
            full_name: data.personal_info?.full_name || user?.full_name || "",
            email: data.personal_info?.email || user?.email || "",
            professional_title: data.personal_info?.professional_title || "",
            phone: data.personal_info?.phone || "",
            location: data.personal_info?.location || "",
            linkedin_url: data.personal_info?.linkedin_url || "",
            github_url: data.personal_info?.github_url || "",
            portfolio_url: data.personal_info?.portfolio_url || "",
            summary: data.personal_info?.summary || "",
          },
          experience: data.experience || [],
          education: data.education || [],
          skills: data.skills || [],
          projects: data.projects || [],
          certifications: data.certifications || [],
        }));
      } catch (err: any) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      loadData();
    }
  }, [user]);

  const handleSaveProfile = async (silent = false) => {
    try {
      setSaving(true);
      setErrorMsg(null);
      const saved = await saveProfile(profile);
      if (!silent) {
        setSuccessMsg("Profile saved successfully!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      return saved;
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save profile.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Step 1: When user selects a file, validate and show the job title modal
  const handleFileSelect = (file: File) => {
    if (!file) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".pdf") && !fileName.endsWith(".docx")) {
      setUploadError("Invalid file type. Only PDF (.pdf) and Word (.docx) documents are allowed.");
      return;
    }
    setUploadError(null);
    setPendingFile(file);
    setJobTitleInput("");
    setFormatModalMode("upload");
    setShowJobTitleModal(true);
  };

  // Step 2: When user submits the job title, actually upload and process
  const handleFileUpload = async (file: File, jobTitle: string) => {
    setShowJobTitleModal(false);
    setPendingFile(null);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStepText("Uploading CV file...");

    try {
      await new Promise((r) => setTimeout(r, 400));
      setUploadProgress(40);
      setUploadStepText("Extracting raw document text...");

      await new Promise((r) => setTimeout(r, 400));
      setUploadProgress(70);
      const roleLabel = jobTitle || "General";
      setUploadStepText("Formatting profile for \u201c" + roleLabel + "\u201d role with AI...");

      const savedProfile = await uploadCVFile(file, jobTitle);
      setUploadProgress(100);
      setUploadStepText("CV processed & saved to your profile!");

      // The backend now returns the saved profile directly
      if (savedProfile) {
        setProfile((prev) => ({
          ...prev,
          personal_info: {
            ...prev.personal_info,
            full_name: savedProfile.personal_info?.full_name || prev.personal_info.full_name,
            professional_title: savedProfile.personal_info?.professional_title || prev.personal_info.professional_title,
            email: savedProfile.personal_info?.email || prev.personal_info.email,
            phone: savedProfile.personal_info?.phone || prev.personal_info.phone,
            location: savedProfile.personal_info?.location || prev.personal_info.location,
            linkedin_url: savedProfile.personal_info?.linkedin_url || prev.personal_info.linkedin_url,
            github_url: savedProfile.personal_info?.github_url || prev.personal_info.github_url,
            portfolio_url: savedProfile.personal_info?.portfolio_url || prev.personal_info.portfolio_url,
            summary: savedProfile.personal_info?.summary || prev.personal_info.summary,
          },
          experience: savedProfile.experience?.length ? savedProfile.experience : prev.experience,
          education: savedProfile.education?.length ? savedProfile.education : prev.education,
          skills: savedProfile.skills?.length ? Array.from(new Set([...prev.skills, ...savedProfile.skills])) : prev.skills,
          projects: savedProfile.projects?.length ? savedProfile.projects : prev.projects,
          certifications: savedProfile.certifications?.length ? savedProfile.certifications : prev.certifications,
        }));
        setExtractedNotice(true);
        setSuccessMsg("Profile auto-saved from your CV! Review your data below.");
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to process CV upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateResume = async () => {
    await handleSaveProfile(true);
    setGenerating(true);
    try {
      const res = await generateResume();
      router.push(`/resumes/${res.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate resume.");
      setGenerating(false);
    }
  };

  // Open the job title modal in "format" mode (for manually entered data)
  const triggerFormatModal = () => {
    setFormatModalMode("format");
    setJobTitleInput(profile.personal_info.professional_title || "");
    setShowJobTitleModal(true);
  };

  // Send current profile data through Grok for AI enhancement
  const handleFormatWithAI = async (jobTitle: string) => {
    setShowJobTitleModal(false);
    setFormatting(true);
    setErrorMsg(null);
    try {
      const formatted = await formatProfileWithAI(profile, jobTitle);
      if (formatted) {
        setProfile((prev) => ({
          ...prev,
          personal_info: {
            ...prev.personal_info,
            full_name: formatted.personal_info?.full_name || prev.personal_info.full_name,
            professional_title: formatted.personal_info?.professional_title || prev.personal_info.professional_title,
            email: formatted.personal_info?.email || prev.personal_info.email,
            phone: formatted.personal_info?.phone || prev.personal_info.phone,
            location: formatted.personal_info?.location || prev.personal_info.location,
            linkedin_url: formatted.personal_info?.linkedin_url || prev.personal_info.linkedin_url,
            github_url: formatted.personal_info?.github_url || prev.personal_info.github_url,
            portfolio_url: formatted.personal_info?.portfolio_url || prev.personal_info.portfolio_url,
            summary: formatted.personal_info?.summary || prev.personal_info.summary,
          },
          experience: formatted.experience?.length ? formatted.experience : prev.experience,
          education: formatted.education?.length ? formatted.education : prev.education,
          skills: formatted.skills?.length ? Array.from(new Set([...prev.skills, ...formatted.skills])) : prev.skills,
          projects: formatted.projects?.length ? formatted.projects : prev.projects,
          certifications: formatted.certifications?.length ? formatted.certifications : prev.certifications,
        }));
        setSuccessMsg("Profile formatted and saved with AI! Review your enhanced data.");
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to format profile with AI.");
    } finally {
      setFormatting(false);
    }
  };

  // Profile Completeness Calculation
  const calculateCompleteness = () => {
    let total = 0;
    let score = 0;

    total += 3; // Name, Email, Title
    if (profile.personal_info.full_name) score++;
    if (profile.personal_info.email) score++;
    if (profile.personal_info.professional_title) score++;

    total += 1;
    if (profile.experience.length > 0) score++;

    total += 1;
    if (profile.education.length > 0) score++;

    total += 1;
    if (profile.skills.length > 0) score++;

    return Math.round((score / total) * 100);
  };

  // Helper State Handlers for Repeatable Entries
  const addExperienceItem = () => {
    setProfile((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          company: "",
          position: "",
          location: "",
          employment_type: "Full-time",
          start_date: "",
          end_date: "",
          is_current: false,
          description: "",
          achievements: [""],
        },
      ],
    }));
  };

  const updateExperienceItem = (index: number, field: keyof ExperienceItem, val: any) => {
    setProfile((prev) => {
      const updated = [...prev.experience];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, experience: updated };
    });
  };

  const removeExperienceItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  };

  const addAchievementBullet = (expIndex: number) => {
    setProfile((prev) => {
      const updated = [...prev.experience];
      const bullets = [...(updated[expIndex].achievements || []), ""];
      updated[expIndex] = { ...updated[expIndex], achievements: bullets };
      return { ...prev, experience: updated };
    });
  };

  const updateAchievementBullet = (expIndex: number, bulletIndex: number, text: string) => {
    setProfile((prev) => {
      const updated = [...prev.experience];
      const bullets = [...(updated[expIndex].achievements || [])];
      bullets[bulletIndex] = text;
      updated[expIndex] = { ...updated[expIndex], achievements: bullets };
      return { ...prev, experience: updated };
    });
  };

  const removeAchievementBullet = (expIndex: number, bulletIndex: number) => {
    setProfile((prev) => {
      const updated = [...prev.experience];
      const bullets = updated[expIndex].achievements.filter((_, i) => i !== bulletIndex);
      updated[expIndex] = { ...updated[expIndex], achievements: bullets };
      return { ...prev, experience: updated };
    });
  };

  const addEducationItem = () => {
    setProfile((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          institution: "",
          degree: "",
          field_of_study: "",
          start_date: "",
          end_date: "",
          is_current: false,
          gpa: "",
          description: "",
        },
      ],
    }));
  };

  const updateEducationItem = (index: number, field: keyof EducationItem, val: any) => {
    setProfile((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, education: updated };
    });
  };

  const removeEducationItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const addSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (trimmed && !profile.skills.includes(trimmed)) {
      setProfile((prev) => ({
        ...prev,
        skills: [...prev.skills, trimmed],
      }));
    }
    setSkillInput("");
  };

  const removeSkill = (skillName: string) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillName),
    }));
  };

  const addProjectItem = () => {
    setProfile((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          name: "",
          description: "",
          technologies: [],
          project_url: "",
          github_url: "",
          achievements: [""],
        },
      ],
    }));
  };

  const updateProjectItem = (index: number, field: keyof ProjectItem, val: any) => {
    setProfile((prev) => {
      const updated = [...prev.projects];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, projects: updated };
    });
  };

  const removeProjectItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const addCertificationItem = () => {
    setProfile((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          name: "",
          issuing_organization: "",
          issue_date: "",
          expiration_date: "",
          credential_id: "",
          credential_url: "",
        },
      ],
    }));
  };

  const updateCertificationItem = (index: number, field: keyof CertificationItem, val: any) => {
    setProfile((prev) => {
      const updated = [...prev.certifications];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, certifications: updated };
    });
  };

  const removeCertificationItem = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#2563EB", marginBottom: "8px" }}>PrepCV</div>
            <div style={{ fontSize: "14px", color: "#64748B" }}>Loading candidate profile...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const steps = [
    { num: 1, title: "Personal" },
    { num: 2, title: "Experience" },
    { num: 3, title: "Education" },
    { num: 4, title: "Skills" },
    { num: 5, title: "Projects" },
    { num: 6, title: "Certifications (Optional)" },
    { num: 7, title: "Review Profile" },
  ];

  const completeness = calculateCompleteness();

  return (
    <ProtectedRoute>
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
        {/* Navigation Bar */}
        <header style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div
            onClick={() => router.push("/dashboard")}
            style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
          >
            Prep<span style={{ color: "#2563EB" }}>CV</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                backgroundColor: "#FFFFFF",
                color: "#64748B",
                border: "1px solid #CBD5E1",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              ← Dashboard
            </button>
            <button
              onClick={() => handleSaveProfile(false)}
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
              {saving ? "Saving..." : "Save Profile"}
            </button>
            <button
              onClick={triggerFormatModal}
              disabled={formatting}
              style={{
                background: formatting ? "#94A3B8" : "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: formatting ? "not-allowed" : "pointer",
                boxShadow: formatting ? "none" : "0 2px 8px rgba(124, 58, 237, 0.3)",
                transition: "all 0.2s ease",
              }}
            >
              {formatting ? "⏳ Formatting..." : "✨ Format with AI"}
            </button>
          </div>
        </header>

        {/* Wizard Main Container */}
        <main style={{ maxWidth: "960px", margin: "32px auto", padding: "0 24px" }}>
          
          {/* Header Title & Stepper */}
          <div style={{ marginBottom: "28px", textAlign: "center" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Build your professional profile
            </h1>
            <p style={{ fontSize: "14px", color: "#64748B", marginTop: "6px" }}>
              This structured data will be used to generate your ATS-optimized resume.
            </p>

            {/* Completeness Bar */}
            <div style={{ maxWidth: "400px", margin: "16px auto 0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                <span>Profile Completeness</span>
                <span>{completeness}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#E2E8F0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${completeness}%`, height: "100%", backgroundColor: "#2563EB", transition: "width 0.4s ease" }}></div>
              </div>
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "12px 16px", borderRadius: "8px", fontSize: "14px", marginBottom: "20px" }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16A34A", padding: "12px 16px", borderRadius: "8px", fontSize: "14px", marginBottom: "20px" }}>
              ✓ {successMsg}
            </div>
          )}

          {/* Extracted Notice Banner */}
          {extractedNotice && (
            <div style={{ backgroundColor: "#F0F9FF", border: "1px solid #BAE6FD", color: "#0369A1", padding: "14px 18px", borderRadius: "10px", fontSize: "14px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>✨ Extracted data pre-filled!</strong> Please review and correct your information in the steps below before generating your resume.
              </div>
              <button
                onClick={() => setExtractedNotice(false)}
                style={{ background: "none", border: "none", color: "#0369A1", cursor: "pointer", fontWeight: 600 }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Stepper Tabs Bar */}
          <div style={{
            display: "flex",
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "8px",
            marginBottom: "28px",
            overflowX: "auto",
            gap: "4px"
          }}>
            {steps.map((step) => {
              const isActive = activeStep === step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  style={{
                    flex: 1,
                    minWidth: "110px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isActive ? "#2563EB" : "transparent",
                    color: isActive ? "#FFFFFF" : "#64748B",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap"
                  }}
                >
                  {step.num}. {step.title}
                </button>
              );
            })}
          </div>

          {/* Step 1 Entry Card: CV Upload Option + Personal Info */}
          {activeStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Upload Existing CV Component */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "2px dashed #CBD5E1",
                padding: "28px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>📄</div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                  Upload existing CV for Auto-Extraction
                </h3>
                <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 16px 0" }}>
                  Skip manual entry. We'll extract your work experience, education, skills, and projects automatically.
                </p>

                {isUploading ? (
                  <div style={{ maxWidth: "450px", margin: "0 auto", textAlign: "left" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563EB", marginBottom: "8px" }}>
                      ● {uploadStepText}
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "#E2E8F0", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${uploadProgress}%`, height: "100%", backgroundColor: "#2563EB", transition: "width 0.3s ease" }}></div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{
                      backgroundColor: "#2563EB",
                      color: "#FFFFFF",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-block"
                    }}>
                      Browse & Upload CV (PDF / DOCX)
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                    {uploadError && (
                      <div style={{ color: "#DC2626", fontSize: "13px", marginTop: "12px", fontWeight: 500 }}>
                        ⚠ {uploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Personal Info Form */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "32px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
              }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", marginBottom: "20px" }}>
                  Personal Information
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={profile.personal_info.full_name}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, full_name: e.target.value }
                      })}
                      placeholder="e.g. Muhammad Bilal Sajid"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Professional Title *
                    </label>
                    <input
                      type="text"
                      value={profile.personal_info.professional_title}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, professional_title: e.target.value }
                      })}
                      placeholder="e.g. AI Engineer"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={profile.personal_info.email}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, email: e.target.value }
                      })}
                      placeholder="e.g. bilal@example.com"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={profile.personal_info.phone}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, phone: e.target.value }
                      })}
                      placeholder="e.g. +92 311 1234567"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Location
                    </label>
                    <input
                      type="text"
                      value={profile.personal_info.location}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, location: e.target.value }
                      })}
                      placeholder="e.g. Lahore, Pakistan"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      LinkedIn URL
                    </label>
                    <input
                      type="text"
                      value={profile.personal_info.linkedin_url}
                      onChange={(e) => setProfile({
                        ...profile,
                        personal_info: { ...profile.personal_info, linkedin_url: e.target.value }
                      })}
                      placeholder="e.g. linkedin.com/in/bilal"
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Professional Summary / Objective
                  </label>
                  <textarea
                    rows={4}
                    value={profile.personal_info.summary}
                    onChange={(e) => setProfile({
                      ...profile,
                      personal_info: { ...profile.personal_info, summary: e.target.value }
                    })}
                    placeholder="Brief summary of your background, key strengths, and career focus..."
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontFamily: "inherit" }}
                  />
                </div>

                <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      handleSaveProfile(true);
                      setActiveStep(2);
                    }}
                    style={{
                      backgroundColor: "#2563EB",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 24px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Save & Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Work Experience */}
          {activeStep === 2 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Work Experience</h2>
                  <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>Add your previous employment and achievements.</p>
                </div>
                <button
                  onClick={addExperienceItem}
                  style={{
                    backgroundColor: "#EFF6FF",
                    color: "#2563EB",
                    border: "1px solid #BFDBFE",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  + Add Experience
                </button>
              </div>

              {profile.experience.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                  <p style={{ color: "#64748B", margin: 0 }}>No work experience added yet.</p>
                  <button
                    onClick={addExperienceItem}
                    style={{ marginTop: "12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}
                  >
                    + Add Work Experience
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {profile.experience.map((exp, idx) => (
                    <div key={idx} style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "20px", backgroundColor: "#FAFAFA" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB" }}>Experience #{idx + 1}</span>
                        <button
                          onClick={() => removeExperienceItem(idx)}
                          style={{ backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Job Title *</label>
                          <input
                            type="text"
                            value={exp.position}
                            onChange={(e) => updateExperienceItem(idx, "position", e.target.value)}
                            placeholder="e.g. Senior AI Engineer"
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Company *</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => updateExperienceItem(idx, "company", e.target.value)}
                            placeholder="e.g. Tech Solutions"
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Start Date (From) *</label>
                          <input
                            type="text"
                            value={exp.start_date}
                            onChange={(e) => updateExperienceItem(idx, "start_date", e.target.value)}
                            placeholder="e.g. Jan 2023"
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>End Date (To)</label>
                          <input
                            type="text"
                            disabled={exp.is_current}
                            value={exp.is_current ? "Present" : exp.end_date}
                            onChange={(e) => updateExperienceItem(idx, "end_date", e.target.value)}
                            placeholder="e.g. Dec 2024 or Present"
                            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                          />
                          <label style={{ fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                            <input
                              type="checkbox"
                              checked={exp.is_current}
                              onChange={(e) => updateExperienceItem(idx, "is_current", e.target.checked)}
                            />
                            I currently work here
                          </label>
                        </div>
                      </div>

                      {/* Repeatable Achievement Bullets */}
                      <div style={{ marginTop: "16px" }}>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
                          Key Achievements / Bullets
                        </label>
                        {exp.achievements?.map((bullet, bIdx) => (
                          <div key={bIdx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                            <span style={{ fontSize: "14px", color: "#64748B", paddingTop: "8px" }}>•</span>
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => updateAchievementBullet(idx, bIdx, e.target.value)}
                              placeholder="Describe quantifiable result e.g. Improved API response time by 40%"
                              style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                            />
                            <button
                              onClick={() => removeAchievementBullet(idx, bIdx)}
                              style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", padding: "0 10px", borderRadius: "6px", cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addAchievementBullet(idx)}
                          style={{ fontSize: "13px", color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, marginTop: "4px" }}
                        >
                          + Add achievement bullet
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setActiveStep(1)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
                  ← Back
                </button>
                <button
                  onClick={() => {
                    handleSaveProfile(true);
                    setActiveStep(3);
                  }}
                  style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Education */}
          {activeStep === 3 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Education</h2>
                  <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>Add degrees, universities, and academic honors.</p>
                </div>
                <button onClick={addEducationItem} style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  + Add Degree
                </button>
              </div>

              {profile.education.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                  <p style={{ color: "#64748B", margin: 0 }}>No education added yet.</p>
                  <button onClick={addEducationItem} style={{ marginTop: "12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
                    + Add Degree
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profile.education.map((edu, idx) => (
                    <div key={idx} style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "20px", backgroundColor: "#FAFAFA" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB" }}>Degree #{idx + 1}</span>
                        <button onClick={() => removeEducationItem(idx)} style={{ backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Institution / University *</label>
                          <input type="text" value={edu.institution} onChange={(e) => updateEducationItem(idx, "institution", e.target.value)} placeholder="e.g. University of XYZ" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Degree *</label>
                          <input type="text" value={edu.degree} onChange={(e) => updateEducationItem(idx, "degree", e.target.value)} placeholder="e.g. Bachelor of Science" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Start Date (From) *</label>
                          <input type="text" value={edu.start_date} onChange={(e) => updateEducationItem(idx, "start_date", e.target.value)} placeholder="e.g. Sep 2019" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>End Date / Graduation (To) *</label>
                          <input type="text" value={edu.end_date} onChange={(e) => updateEducationItem(idx, "end_date", e.target.value)} placeholder="e.g. Jun 2023" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>GPA (Optional)</label>
                          <input type="text" value={edu.gpa} onChange={(e) => updateEducationItem(idx, "gpa", e.target.value)} placeholder="e.g. 3.8 / 4.0" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setActiveStep(2)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={() => { handleSaveProfile(true); setActiveStep(4); }} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Skills */}
          {activeStep === 4 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "32px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>Skills & Technologies</h2>
              <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 20px 0" }}>Highlight technical stack, domain skills, and frameworks.</p>

              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                  placeholder="Type a skill and press Enter..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
                <button onClick={() => addSkill(skillInput)} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                  Add Skill
                </button>
              </div>

              {/* Active Skill Chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px", minHeight: "40px" }}>
                {profile.skills.map((skill) => (
                  <span key={skill} style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "6px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    {skill}
                    <button onClick={() => removeSkill(skill)} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", padding: 0, fontSize: "14px" }}>
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Suggested Skills */}
              <div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "8px" }}>Suggested Skills:</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {SUGGESTED_SKILLS.filter((s) => !profile.skills.includes(s)).map((suggested) => (
                    <button key={suggested} onClick={() => addSkill(suggested)} style={{ backgroundColor: "#F1F5F9", color: "#475569", border: "1px solid #CBD5E1", padding: "4px 10px", borderRadius: "16px", fontSize: "12px", cursor: "pointer" }}>
                      + {suggested}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setActiveStep(3)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={() => { handleSaveProfile(true); setActiveStep(5); }} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Projects */}
          {activeStep === 5 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Featured Projects</h2>
                  <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>Add side projects, open-source work, or portfolio items.</p>
                </div>
                <button onClick={addProjectItem} style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  + Add Project
                </button>
              </div>

              {profile.projects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                  <p style={{ color: "#64748B", margin: 0 }}>No projects added yet.</p>
                  <button onClick={addProjectItem} style={{ marginTop: "12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
                    + Add Project
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profile.projects.map((proj, idx) => (
                    <div key={idx} style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "20px", backgroundColor: "#FAFAFA" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB" }}>Project #{idx + 1}</span>
                        <button onClick={() => removeProjectItem(idx)} style={{ backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Project Name *</label>
                          <input type="text" value={proj.name} onChange={(e) => updateProjectItem(idx, "name", e.target.value)} placeholder="e.g. AI Resume Builder" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Project URL</label>
                          <input type="text" value={proj.project_url} onChange={(e) => updateProjectItem(idx, "project_url", e.target.value)} placeholder="e.g. https://project.com" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Description *</label>
                        <textarea rows={2} value={proj.description} onChange={(e) => updateProjectItem(idx, "description", e.target.value)} placeholder="Brief summary of what the project accomplishes..." style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setActiveStep(4)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={() => { handleSaveProfile(true); setActiveStep(6); }} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Certifications */}
          {activeStep === 6 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: 0 }}>Certifications</h2>
                  <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>Add cloud, technical, or professional certifications.</p>
                </div>
                <button onClick={addCertificationItem} style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "8px 16px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  + Add Certification
                </button>
              </div>

              {profile.certifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                  <p style={{ color: "#64748B", margin: 0 }}>No certifications added yet.</p>
                  <button onClick={addCertificationItem} style={{ marginTop: "12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
                    + Add Certification
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {profile.certifications.map((cert, idx) => (
                    <div key={idx} style={{ border: "1px solid #E2E8F0", borderRadius: "10px", padding: "20px", backgroundColor: "#FAFAFA" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB" }}>Certification #{idx + 1}</span>
                        <button onClick={() => removeCertificationItem(idx)} style={{ backgroundColor: "#FEE2E2", color: "#DC2626", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Certification Name *</label>
                          <input type="text" value={cert.name} onChange={(e) => updateCertificationItem(idx, "name", e.target.value)} placeholder="e.g. AWS Certified Cloud Practitioner" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Issuing Organization *</label>
                          <input type="text" value={cert.issuing_organization} onChange={(e) => updateCertificationItem(idx, "issuing_organization", e.target.value)} placeholder="e.g. Amazon Web Services" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "14px" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: "28px", display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setActiveStep(5)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={() => { handleSaveProfile(true); setActiveStep(7); }} style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Review Profile →
                </button>
              </div>
            </div>
          )}

          {/* Step 7: Final Review & Generate Resume Action */}
          {activeStep === 7 && (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "36px", textAlign: "center" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
                Review your candidate profile
              </h2>
              <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 24px 0" }}>
                Everything look accurate? Generate your ATS-optimized resume in under 15 seconds.
              </p>

              {/* Summary Checklist */}
              <div style={{ maxWidth: "500px", margin: "0 auto 32px auto", textAlign: "left", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "20px" }}>
                <div style={{ fontSize: "14px", color: profile.personal_info.full_name ? "#16A34A" : "#DC2626", marginBottom: "8px", fontWeight: 600 }}>
                  {profile.personal_info.full_name ? "✓" : "⚠"} Personal Info: {profile.personal_info.full_name || "Missing Name"} ({profile.personal_info.professional_title || "No Title"})
                </div>
                <div style={{ fontSize: "14px", color: profile.experience.length ? "#16A34A" : "#D97706", marginBottom: "8px", fontWeight: 600 }}>
                  {profile.experience.length ? "✓" : "⚠"} Work Experience: {profile.experience.length} position(s) added
                </div>
                <div style={{ fontSize: "14px", color: profile.education.length ? "#16A34A" : "#D97706", marginBottom: "8px", fontWeight: 600 }}>
                  {profile.education.length ? "✓" : "⚠"} Education: {profile.education.length} degree(s) added
                </div>
                <div style={{ fontSize: "14px", color: profile.skills.length ? "#16A34A" : "#D97706", marginBottom: "8px", fontWeight: 600 }}>
                  {profile.skills.length ? "✓" : "⚠"} Skills: {profile.skills.length} skill tag(s) highlighted
                </div>
                <div style={{ fontSize: "14px", color: profile.projects.length ? "#16A34A" : "#64748B", marginBottom: "8px" }}>
                  {profile.projects.length ? "✓" : "○"} Projects: {profile.projects.length} project(s)
                </div>
                <div style={{ fontSize: "14px", color: profile.certifications.length ? "#16A34A" : "#64748B" }}>
                  {profile.certifications.length ? "✓" : "○"} Certifications: {profile.certifications.length} certification(s)
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
                <button
                  onClick={() => setActiveStep(1)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: "#334155",
                    border: "1px solid #CBD5E1",
                    padding: "12px 24px",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Edit Profile Data
                </button>
                <button
                  onClick={handleGenerateResume}
                  disabled={generating}
                  style={{
                    backgroundColor: "#7C3AED",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "12px 32px",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)"
                  }}
                >
                  {generating ? "✨ Generating ATS Resume (<15s)..." : "✨ Generate Resume"}
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Job Title Modal Overlay */}
        {showJobTitleModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              animation: "modalFadeIn 0.2s ease",
            }}
            onClick={() => {
              setShowJobTitleModal(false);
              setPendingFile(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "36px 32px",
                maxWidth: "480px",
                width: "90%",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(37, 99, 235, 0.1)",
                animation: "modalSlideUp 0.25s ease",
              }}
            >
              {/* Modal Header */}
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                  What position are you targeting?
                </h3>
                <p style={{ fontSize: "14px", color: "#64748B", margin: 0, lineHeight: "1.5" }}>
                  {formatModalMode === "format"
                    ? "Our AI will enhance your profile data — polishing descriptions, adding impact metrics, and tailoring content for this role."
                    : "This helps our AI tailor your CV data for the role \u2014 enhancing descriptions, skills, and formatting for maximum ATS impact."}
                </p>
              </div>

              {/* Job Title Input */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
                  Target Job Title / Position *
                </label>
                <input
                  type="text"
                  value={jobTitleInput}
                  onChange={(e) => setJobTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && jobTitleInput.trim()) {
                      if (formatModalMode === "format") {
                        handleFormatWithAI(jobTitleInput.trim());
                      } else if (pendingFile) {
                        handleFileUpload(pendingFile, jobTitleInput.trim());
                      }
                    }
                  }}
                  placeholder="e.g. AI Engineer, Full Stack Developer, Data Scientist"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "2px solid #CBD5E1",
                    fontSize: "15px",
                    outline: "none",
                    transition: "border-color 0.2s ease",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                  onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                />
                {formatModalMode === "upload" && pendingFile && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                    📎 {pendingFile.name}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => {
                    setShowJobTitleModal(false);
                    setPendingFile(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#64748B",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (formatModalMode === "format") {
                      handleFormatWithAI(jobTitleInput.trim());
                    } else if (pendingFile) {
                      handleFileUpload(pendingFile, jobTitleInput.trim());
                    }
                  }}
                  disabled={!jobTitleInput.trim()}
                  style={{
                    flex: 2,
                    padding: "12px 20px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: jobTitleInput.trim() ? "#2563EB" : "#94A3B8",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: jobTitleInput.trim() ? "pointer" : "not-allowed",
                    transition: "background-color 0.2s ease",
                    boxShadow: jobTitleInput.trim() ? "0 4px 12px rgba(37, 99, 235, 0.3)" : "none",
                  }}
                >
                  {formatModalMode === "format" ? "✨ Format Profile with AI" : "🚀 Process CV with AI"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal animations */}
        <style>{`
          @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(20px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
