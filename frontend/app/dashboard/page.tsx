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
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
            Prep<span style={{ color: "#2563EB" }}>CV</span>
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
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Dashboard Main Content */}
        <main style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 24px" }}>
          
          {/* Welcome Header Banner */}
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            marginBottom: "28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700
              }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Welcome back, {user?.full_name}!
                </h1>
                <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>
                  {profile?.personal_info?.professional_title || "Candidate Account"} ({user?.email})
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => router.push("/profile")}
                style={{
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Build / Edit Profile
              </button>
            </div>
          </div>

          {/* Grid Layout: Profile Status & Quick Resume Generation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
            
            {/* Card 1: Profile Completeness */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 12px 0" }}>
                Profile Progress
              </h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                <span>Structured Profile Data</span>
                <span>{completeness}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#E2E8F0", borderRadius: "4px", overflow: "hidden", marginBottom: "16px" }}>
                <div style={{ width: `${completeness}%`, height: "100%", backgroundColor: "#2563EB", transition: "width 0.4s ease" }}></div>
              </div>
              <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                {completeness > 50
                  ? "Your profile has sufficient details to generate a high-scoring ATS resume."
                  : "Complete your work experience and skills to maximize ATS optimization."}
              </p>
              <button
                onClick={() => router.push("/profile")}
                style={{ backgroundColor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%" }}
              >
                Manage Candidate Profile →
              </button>
            </div>

            {/* Card 2: Quick Resume Action */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 8px 0" }}>
                ✨ AI ATS Resume Generator
              </h3>
              <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                Generate an ATS-safe single-column resume with action-driven bullet points in under 15 seconds.
              </p>
              <button
                onClick={() => router.push("/profile")}
                style={{ backgroundColor: "#7C3AED", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "6px", fontSize: "14px", fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                + Generate New Resume
              </button>
            </div>

          </div>

          {/* Saved Resumes Section */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "28px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>
              My Saved Resumes ({resumes.length})
            </h2>

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
                    onClick={() => router.push(`/resumes/${resume.id}`)}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "20px",
                      backgroundColor: "#FAFAFA",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        {resume.title}
                      </h4>
                      <span style={{ backgroundColor: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                        ATS Ready ✓
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#64748B", margin: "0 0 12px 0" }}>
                      Updated: {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                    <div style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>
                      Open Resume Editor →
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
