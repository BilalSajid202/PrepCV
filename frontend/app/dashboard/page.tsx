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

  // Compute average or highest ATS score
  const highestAtsScore = resumes.reduce((max, r) => (r.ats_score && r.ats_score > max ? r.ats_score : max), 0) || 87;

  const getScoreTier = (score: number) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Needs Boost";
  };

  const getScoreColor = (score: number) => {
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
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              {getGreeting()}, {user?.full_name || "Muhammad"} 👋
            </h1>
            <p style={{ fontSize: "14.5px", color: "#64748B", margin: 0 }}>
              Let's get you ready for your next job.
            </p>
          </div>

          {/* 2 Hero Stat Cards */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "32px" }}>
            
            {/* Card 1: ATS Score */}
            <div
              onClick={() => router.push("/ats-checker")}
              style={{
                width: "200px",
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", marginBottom: "8px" }}>
                ATS Score
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
                width: "200px",
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "20px 24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#64748B", marginBottom: "8px" }}>
                Interviews
              </div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: "#2563EB", lineHeight: 1.1 }}>
                {sessions.length || 4}
              </div>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748B", marginTop: "6px" }}>
                Prep Sessions
              </div>
            </div>

          </div>

          {/* Recent Resumes Section */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Recent Resumes
              </h2>
              {resumes.length > 0 && (
                <button
                  onClick={() => router.push("/profile")}
                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  View All ({resumes.length}) →
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
                resumes.slice(0, 3).map((resume, idx) => (
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
                        backgroundColor: "#F0FDF4",
                        color: "#16A34A",
                        border: "1px solid #BBF7D0",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}>
                        {resume.ats_score ? `${resume.ats_score}%` : "87%"}
                      </span>
                      <span style={{ fontSize: "16px", color: "#94A3B8" }}>→</span>
                    </div>
                  </div>
                ))
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
                gap: "6px",
              }}
            >
              <span>＋</span> Create New Resume
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
                gap: "6px",
              }}
            >
              <span>💬</span> Prepare for Interview
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
                gap: "6px",
              }}
            >
              <span>🎯</span> ATS Checker
            </button>
          </div>

        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
