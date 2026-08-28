"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import { useAuth } from "@/lib/auth-context";
import { CandidateProfile, ResumeData, fetchProfile, listUserResumes } from "@/lib/api";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [profData, resumesData] = await Promise.all([
          fetchProfile().catch(() => null),
          listUserResumes().catch(() => []),
        ]);
        if (profData) setProfile(profData);
        if (resumesData) setResumes(resumesData);
      } catch (err) {
        console.error("Error loading dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const calculateCompleteness = () => {
    if (!profile) return 0;
    let score = 0;
    let total = 6;
    if (profile.personal_info?.full_name) score++;
    if (profile.personal_info?.professional_title) score++;
    if (profile.experience?.length) score++;
    if (profile.education?.length) score++;
    if (profile.skills?.length) score++;
    if (profile.projects?.length || profile.certifications?.length) score++;
    return Math.round((score / total) * 100);
  };

  const completeness = calculateCompleteness();

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#16A34A";
    if (score >= 75) return "#2563EB";
    if (score >= 50) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ProtectedRoute>
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
        {/* Navigation Bar */}
        <header style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          padding: "0 32px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }} onClick={() => router.push("/dashboard")}>
              Prep<span style={{ color: "#2563EB" }}>CV</span>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#EFF6FF", fontSize: "14px", fontWeight: 600, color: "#2563EB", cursor: "pointer" }}>
                Dashboard
              </button>
              <button onClick={() => router.push("/profile")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 500, color: "#64748B", cursor: "pointer" }}>
                Profile
              </button>
              <button onClick={() => router.push("/ats-checker")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "transparent", fontSize: "14px", fontWeight: 600, color: "#7C3AED", cursor: "pointer" }}>
                🎯 ATS Checker
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "14px", color: "#64748B" }}>
              Signed in as <strong style={{ color: "#0F172A" }}>{user?.full_name}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: "#F1F5F9",
                color: "#0F172A",
                border: "1px solid #CBD5E1",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Dashboard Main Content */}
        <main style={{ maxWidth: "1050px", margin: "32px auto", padding: "0 24px" }}>
          
          {/* Welcome Header Banner */}
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "28px 32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            marginBottom: "28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700
              }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Welcome back, {user?.full_name}!
                </h1>
                <p style={{ fontSize: "13.5px", color: "#64748B", margin: "4px 0 0 0" }}>
                  {profile?.personal_info?.professional_title || "Candidate Account"} • {user?.email}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => router.push("/ats-checker")}
                style={{
                  backgroundColor: "#F5F3FF",
                  color: "#7C3AED",
                  border: "1px solid #DDD6FE",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                🎯 Open ATS Checker
              </button>
              <button
                onClick={() => router.push("/profile")}
                style={{
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Profile & Builder
              </button>
            </div>
          </div>

          {/* Grid: 3 Quick Action Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "28px" }}>
            
            {/* Card 1: Profile Completeness */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 10px 0" }}>
                Candidate Profile
              </h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                <span>Completeness</span>
                <span>{completeness}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#E2E8F0", borderRadius: "3px", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{ width: `${completeness}%`, height: "100%", backgroundColor: "#2563EB" }}></div>
              </div>
              <p style={{ fontSize: "12.5px", color: "#475569", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                {completeness >= 80 ? "Your profile is fully ready for tailored resume generation." : "Add experience and skills to boost ATS results."}
              </p>
              <button
                onClick={() => router.push("/profile")}
                style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", width: "100%" }}
              >
                Manage Profile →
              </button>
            </div>

            {/* Card 2: ATS Match Scoring */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
                🎯 ATS Match Scoring
              </h3>
              <p style={{ fontSize: "12.5px", color: "#475569", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Paste any job description to evaluate your resume against ATS screeners and get actionable gap fixes.
              </p>
              <button
                onClick={() => router.push("/ats-checker")}
                style={{ backgroundColor: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", padding: "7px 14px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                Launch ATS Checker →
              </button>
            </div>

            {/* Card 3: Generate New Resume */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
                ✨ New ATS Resume
              </h3>
              <p style={{ fontSize: "12.5px", color: "#475569", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Generate an optimized single-column ATS resume with action verbs and quantifiable bullets.
              </p>
              <button
                onClick={() => router.push("/profile")}
                style={{ backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                + Generate Resume
              </button>
            </div>

          </div>

          {/* Saved Resumes Section with Versioning & ATS score badges */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                My Saved Resumes ({resumes.length})
              </h2>
            </div>

            {loading ? (
              <div style={{ padding: "20px", color: "#64748B", fontSize: "14px" }}>Loading resumes...</div>
            ) : resumes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                <p style={{ color: "#64748B", margin: "0 0 12px 0", fontSize: "14px" }}>
                  No saved resumes yet. Build your profile or upload your CV to generate your first ATS resume.
                </p>
                <button
                  onClick={() => router.push("/profile")}
                  style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 18px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                >
                  Start Profile Onboarding
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {resumes.map((resume) => (
                  <div
                    key={resume.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "18px",
                      backgroundColor: "#FAFAFA",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: "0 0 2px 0" }}>
                          {resume.title}
                        </h4>
                        <span style={{ fontSize: "12px", color: "#64748B" }}>
                          Version {resume.version || 1} • {new Date(resume.updated_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        {resume.ats_score ? (
                          <span style={{ backgroundColor: "#EFF6FF", color: getScoreColor(resume.ats_score), border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                            {resume.ats_score}% ATS
                          </span>
                        ) : (
                          <span style={{ backgroundColor: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                            ATS Safe ✓
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                      <button
                        onClick={() => router.push(`/resumes/${resume.id}`)}
                        style={{ flex: 1, padding: "7px 12px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                      >
                        ✏️ Open Editor
                      </button>
                      <button
                        onClick={() => router.push("/ats-checker")}
                        style={{ padding: "7px 12px", backgroundColor: "#FFFFFF", color: "#7C3AED", border: "1px solid #DDD6FE", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                      >
                        🎯 Check ATS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>
    </ProtectedRoute>
  );
}
