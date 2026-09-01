"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import SidebarLayout from "@/components/sidebar-layout";
import { useAuth } from "@/lib/auth-context";
import {
  ResumeData,
  InterviewSession,
  fetchProfile,
  listUserResumes,
  listInterviewSessions,
} from "@/lib/api";
import {
  FilePlus,
  Bot,
  Target,
  ArrowRight,
  FileText,
  Sparkles,
  Award,
  Video,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [resumesData, sessionsData] = await Promise.all([
          listUserResumes().catch(() => []),
          listInterviewSessions().catch(() => []),
        ]);
        if (resumesData) setResumes(resumesData);
        if (sessionsData) setSessions(sessionsData);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Compute highest ATS score dynamically
  const scoredResumes = resumes.filter((r) => r.ats_score !== undefined && r.ats_score !== null);
  const hasAtsScore = scoredResumes.length > 0;
  const highestAtsScore = hasAtsScore ? Math.max(...scoredResumes.map((r) => r.ats_score || 0)) : 0;

  const getScoreTier = (score: number) => {
    if (!hasAtsScore && score === 0) return "Not Scored";
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Needs Boost";
  };

  const getScoreColor = (score: number) => {
    if (!hasAtsScore && score === 0) return "#64748B";
    if (score >= 85) return "#16A34A";
    if (score >= 70) return "#2563EB";
    if (score >= 50) return "#F59E0B";
    return "#EF4444";
  };

  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return "Updated recently";
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Updated yesterday";
    return `Updated ${diffDays} days ago`;
  };

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div style={{ maxWidth: "860px" }}>
          
          {/* Greeting Header */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>{getGreeting()}, {user?.full_name || "Candidate"}</span>
              <Sparkles size={22} color="#7C3AED" />
            </h1>
            <p style={{ fontSize: "14.5px", color: "#64748B", margin: 0 }}>
              Let's get you ready for your next job.
            </p>
          </div>

          {/* 2 Hero Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px", maxWidth: "460px" }}>
            
            {/* Card 1: ATS Score */}
            <div
              onClick={() => router.push("/ats-checker")}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B" }}>ATS Score</span>
                <Target size={18} color={getScoreColor(highestAtsScore)} />
              </div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: getScoreColor(highestAtsScore), lineHeight: 1.1 }}>
                {highestAtsScore}%
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: getScoreColor(highestAtsScore), marginTop: "6px" }}>
                {getScoreTier(highestAtsScore)}
              </div>
            </div>

            {/* Card 2: Interview Sessions */}
            <div
              onClick={() => router.push("/interview-sessions")}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B" }}>Interviews</span>
                <Bot size={18} color="#2563EB" />
              </div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: "#2563EB", lineHeight: 1.1 }}>
                {sessions.length}
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B", marginTop: "6px" }}>
                Prep Sessions
              </div>
            </div>

          </div>

          {/* Recent Resumes Section */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                <FileText size={18} color="#2563EB" />
                <span>Recent Resumes</span>
              </h2>
              {resumes.length > 0 && (
                <button
                  onClick={() => router.push("/profile")}
                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span>View All ({resumes.length})</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>

            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              {loading ? (
                <div style={{ padding: "24px", color: "#64748B", fontSize: "13.5px" }}>Loading resumes...</div>
              ) : resumes.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#64748B", fontSize: "13.5px" }}>
                  No resumes found yet. Click below to create your first ATS-optimized resume.
                </div>
              ) : (
                resumes.slice(0, 3).map((resume, idx) => {
                  const hasScore = resume.ats_score !== undefined && resume.ats_score !== null;
                  const score = resume.ats_score || 0;
                  const badgeColor = !hasScore ? "#64748B" : score >= 85 ? "#16A34A" : score >= 70 ? "#2563EB" : score >= 50 ? "#D97706" : "#DC2626";
                  const badgeBg = !hasScore ? "#F1F5F9" : score >= 85 ? "#F0FDF4" : score >= 70 ? "#EFF6FF" : score >= 50 ? "#FFFBEB" : "#FEF2F2";
                  const badgeBorder = !hasScore ? "#E2E8F0" : score >= 85 ? "#BBF7D0" : score >= 70 ? "#BFDBFE" : score >= 50 ? "#FDE68A" : "#FECACA";

                  return (
                    <div
                      key={resume.id}
                      onClick={() => router.push(`/resumes/${resume.id}`)}
                      style={{
                        padding: "18px 24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: idx < Math.min(resumes.length, 3) - 1 ? "1px solid #F1F5F9" : "none",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      <div>
                        <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>
                          {resume.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B" }}>
                          {formatTimeAgo(resume.updated_at)}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}>
                          {hasScore ? `${score}%` : "Not Scored"}
                        </span>
                        <ArrowRight size={16} color="#94A3B8" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FilePlus size={16} />
              <span>Create New Resume</span>
            </button>

            <button
              onClick={() => router.push("/interview-prep")}
              style={{
                backgroundColor: "#7C3AED",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Bot size={16} />
              <span>Prepare for Interview</span>
            </button>

            <button
              onClick={() => router.push("/ats-checker")}
              style={{
                backgroundColor: "#FFFFFF",
                color: "#0F172A",
                border: "1px solid #CBD5E1",
                padding: "10px 20px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Target size={16} color="#2563EB" />
              <span>ATS Checker</span>
            </button>
          </div>

        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
