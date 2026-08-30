"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import SidebarLayout from "@/components/sidebar-layout";
import { InterviewSession, listInterviewSessions } from "@/lib/api";

export default function InterviewSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const data = await listInterviewSessions();
        setSessions(data);
        if (data.length > 0) {
          setSelectedSession(data[0]);
        }
      } catch (err) {
        console.error("Failed to load interview sessions", err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div style={{ maxWidth: "960px" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                📚 Interview Prep Sessions
              </h1>
              <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
                Archive of your tailored interview question sets and company intelligence.
              </p>
            </div>

            <button
              onClick={() => router.push("/interview-prep")}
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 18px",
                borderRadius: "8px",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>＋</span> New Prep Session
            </button>
          </div>

          {loading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748B", fontSize: "14px" }}>
              Loading your interview sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>💬</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                No Interview Prep Sessions Yet
              </h3>
              <p style={{ fontSize: "13.5px", color: "#64748B", margin: "0 0 20px 0" }}>
                Generate customized interview questions for your target company and role.
              </p>
              <button
                onClick={() => router.push("/interview-prep")}
                style={{ backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Start Your First Prep Session →
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
              
              {/* Sessions Sidebar List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sessions.map((s) => {
                  const isSelected = selectedSession?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      style={{
                        backgroundColor: isSelected ? "#EFF6FF" : "#FFFFFF",
                        border: `1px solid ${isSelected ? "#2563EB" : "#E2E8F0"}`,
                        borderRadius: "10px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "15px", color: "#0F172A" }}>{s.company_name}</strong>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: isSelected ? "#2563EB" : "#475569", fontWeight: 500, marginBottom: "8px" }}>
                        {s.job_title}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#64748B" }}>
                        {s.generated_questions?.length || 0} Questions Generated
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Session Detail & Questions View */}
              {selectedSession && (
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #F1F5F9" }}>
                    <div>
                      <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0" }}>
                        {selectedSession.company_name}
                      </h2>
                      <div style={{ fontSize: "14px", color: "#2563EB", fontWeight: 600 }}>
                        {selectedSession.job_title}
                      </div>
                      {selectedSession.company_url && (
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                          URL: <a href={selectedSession.company_url} target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>{selectedSession.company_url}</a>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => router.push(`/interview-feedback?company=${encodeURIComponent(selectedSession.company_name)}&role=${encodeURIComponent(selectedSession.job_title)}&sessionId=${encodeURIComponent(selectedSession.id)}`)}
                      style={{ padding: "7px 14px", backgroundColor: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                    >
                      💡 Log Real Feedback
                    </button>
                  </div>

                  {/* Questions Accordion / List */}
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", marginBottom: "14px" }}>
                    Generated Question Set ({selectedSession.generated_questions?.length || 0})
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {selectedSession.generated_questions?.map((q, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "8px",
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", backgroundColor: q.category === "Behavioral" ? "#EFF6FF" : q.category === "Technical" ? "#F5F3FF" : "#ECFDF5", color: q.category === "Behavioral" ? "#2563EB" : q.category === "Technical" ? "#7C3AED" : "#059669" }}>
                            {q.category}
                          </span>
                          {q.difficulty && (
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                              • {q.difficulty}
                            </span>
                          )}
                          {q.focus_area && (
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                              • Focus: {q.focus_area}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#0F172A", fontWeight: 600, lineHeight: 1.45 }}>
                          {idx + 1}. {q.question}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
