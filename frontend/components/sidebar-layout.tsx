"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/feature-context";

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const { user, logout } = useAuth();
  const { hasFeature } = useFeatures();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "📊" },
    { label: "Resumes", href: "/profile", icon: "📄", featureKey: "resume_generation" },
    { label: "ATS Check", href: "/ats-checker", icon: "🎯", featureKey: "ats_checker" },
    { label: "Interview Prep", href: "/interview-prep", icon: "💬", featureKey: "interview_prep" },
    { label: "Sessions", href: "/interview-sessions", icon: "📚" },
    { label: "Feedback", href: "/interview-feedback", icon: "💡", featureKey: "interview_feedback" },
    { label: "Settings", href: "/profile", icon: "⚙️" },
    ...(user?.role === "admin" ? [{ label: "Admin Panel", href: "/admin", icon: "🛡️" }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", color: "#0F172A" }}>
      
      {/* Top Header Bar */}
      <header style={{
        height: "64px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        {/* Left: Brand */}
        <div
          onClick={() => router.push("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
        >
          <div style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "18px",
          }}>
            P
          </div>
          <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A" }}>
            Prep<span style={{ color: "#2563EB" }}>CV</span>
          </span>
          <span style={{ fontSize: "11px", backgroundColor: "#EFF6FF", color: "#2563EB", padding: "2px 6px", borderRadius: "10px", fontWeight: 700, marginLeft: "4px" }}>
            AI PREP
          </span>
        </div>

        {/* Right: Actions & User Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          {/* Bell Icon */}
          <button
            title="Notifications"
            style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "6px", borderRadius: "50%", color: "#64748B" }}
            onClick={() => alert("You're all caught up! No unread notifications.")}
          >
            🔔
          </button>

          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            style={{
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              padding: "5px 12px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>❔</span> Help
          </button>

          <div style={{ height: "24px", width: "1px", backgroundColor: "#E2E8F0" }} />

          {/* User Profile Dropdown */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            >
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: user?.role === "admin" ? "#F59E0B" : "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
              }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                  {user?.full_name || "Candidate"}
                </div>
                <div style={{ fontSize: "11px", color: "#64748B" }}>
                  {user?.role === "admin" ? "🛡️ Administrator" : (user?.email || "Candidate")}
                </div>
              </div>
              <span style={{ fontSize: "10px", color: "#94A3B8" }}>▼</span>
            </div>

            {showUserMenu && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "48px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                border: "1px solid #E2E8F0",
                width: "180px",
                padding: "6px",
                zIndex: 50,
              }}>
                {user?.role === "admin" && (
                  <button
                    onClick={() => { router.push("/admin"); setShowUserMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#F59E0B", fontWeight: 700 }}
                  >
                    🛡️ Admin Panel
                  </button>
                )}
                <button
                  onClick={() => { router.push("/profile"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155" }}
                >
                  👤 Profile & Resume
                </button>
                <button
                  onClick={() => { router.push("/interview-sessions"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155" }}
                >
                  📚 My Prep Sessions
                </button>
                <div style={{ height: "1px", backgroundColor: "#E2E8F0", margin: "4px 0" }} />
                <button
                  onClick={handleLogout}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#DC2626", fontWeight: 600 }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div style={{ display: "flex", flex: 1 }}>
        
        {/* Left Navigation Sidebar */}
        <aside style={{
          width: "230px",
          backgroundColor: "#FFFFFF",
          borderRight: "1px solid #E2E8F0",
          padding: "24px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            const isLocked = item.featureKey && !hasFeature(item.featureKey);

            return (
              <button
                key={item.href + item.label}
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isActive ? "#EFF6FF" : "transparent",
                  color: isActive ? "#2563EB" : isLocked ? "#94A3B8" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.15s ease",
                  opacity: isLocked ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {isLocked && (
                  <span style={{ fontSize: "11px", color: "#F59E0B" }} title="Contact administrator for feature access">
                    🔒
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: "auto", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>🎯 PrepCV Pro Tips</div>
            <div style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
              Paste your target JD in ATS Check and Interview Prep to generate tailored answers.
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, padding: "32px 40px", maxWidth: "1200px" }}>
          {children}
        </main>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "28px", maxWidth: "500px", width: "90%" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 10px 0" }}>
              PrepCV AI Preparation Guide
            </h3>
            <div style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.6, marginBottom: "20px" }}>
              <p><strong>1. Resumes:</strong> Build ATS-safe single-column resumes with quantified bullet points.</p>
              <p><strong>2. ATS Checker:</strong> Paste any JD to calculate your match score, missing skills, and gap recommendations.</p>
              <p><strong>3. Interview Prep:</strong> Enter company URL, job title, and JD to generate tailored Behavioral, Technical, and Role-Specific interview questions.</p>
              <p><strong>4. Feedback RAG:</strong> Log actual interview questions asked in real interviews to help future candidates prepare smarter.</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{ padding: "8px 20px", backgroundColor: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

