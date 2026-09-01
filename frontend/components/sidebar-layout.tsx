"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/feature-context";
import {
  LayoutDashboard,
  FileText,
  Target,
  Bot,
  ListChecks,
  MessageSquareQuote,
  Settings,
  ShieldCheck,
  LogOut,
  Lock,
  Menu,
  X,
  Bell,
  HelpCircle,
  User,
  ChevronDown,
  Sparkles,
} from "lucide-react";

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Resumes", href: "/profile", icon: FileText, featureKey: "resume_generation" },
    { label: "ATS Check", href: "/ats-checker", icon: Target, featureKey: "ats_checker" },
    { label: "Interview Prep", href: "/interview-prep", icon: Bot, featureKey: "interview_prep" },
    { label: "Sessions", href: "/interview-sessions", icon: ListChecks },
    { label: "Feedback", href: "/interview-feedback", icon: MessageSquareQuote, featureKey: "interview_feedback" },
    { label: "Settings", href: "/profile", icon: Settings },
    ...(user?.role === "admin" ? [{ label: "Admin Panel", href: "/admin", icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const renderNavLinks = (isDrawer = false) => (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
        const isLocked = item.featureKey && !hasFeature(item.featureKey);
        const IconComponent = item.icon;

        return (
          <button
            key={item.href + item.label}
            onClick={() => {
              router.push(item.href);
              if (isDrawer) setMobileDrawerOpen(false);
            }}
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
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <IconComponent size={17} color={isActive ? "#2563EB" : "#64748B"} />
              <span>{item.label}</span>
            </div>
            {isLocked && (
              <Lock size={14} color="#F59E0B" />
            )}
          </button>
        );
      })}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", color: "#0F172A" }}>
      
      {/* Top Header Bar */}
      <header style={{
        height: "64px",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}>
        {/* Left: Brand & Hamburger Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="show-on-mobile-flex"
            aria-label="Open Navigation Menu"
            style={{
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              padding: "6px",
              cursor: "pointer",
              color: "#334155",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Menu size={20} />
          </button>

          <div
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
          >
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "16px",
            }}>
              P
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A" }}>
              Prep<span style={{ color: "#2563EB" }}>CV</span>
            </span>
            <span className="hide-on-mobile" style={{ fontSize: "11px", backgroundColor: "#EFF6FF", color: "#2563EB", padding: "2px 6px", borderRadius: "10px", fontWeight: 700, marginLeft: "4px" }}>
              AI PREP
            </span>
          </div>
        </div>

        {/* Right: Actions & User Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Bell Icon */}
          <button
            title="Notifications"
            className="hide-on-mobile"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "50%", color: "#64748B", display: "flex", alignItems: "center" }}
            onClick={() => alert("You're all caught up! No unread notifications.")}
          >
            <Bell size={18} />
          </button>

          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            style={{
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "12.5px",
              fontWeight: 500,
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <HelpCircle size={15} />
            <span className="hide-on-mobile">Help</span>
          </button>

          <div className="hide-on-mobile" style={{ height: "24px", width: "1px", backgroundColor: "#E2E8F0" }} />

          {/* User Profile Dropdown */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: "4px 6px", borderRadius: "6px" }}
            >
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: user?.role === "admin" ? "#F59E0B" : "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "13px",
              }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div className="hide-on-mobile" style={{ textAlign: "left" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                  {user?.full_name || "Candidate"}
                </div>
                <div style={{ fontSize: "10.5px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
                  {user?.role === "admin" ? (
                    <>
                      <ShieldCheck size={11} color="#F59E0B" />
                      <span>Administrator</span>
                    </>
                  ) : (
                    user?.email || "Candidate"
                  )}
                </div>
              </div>
              <ChevronDown size={14} color="#94A3B8" />
            </div>

            {showUserMenu && (
              <div style={{
                position: "absolute",
                right: 0,
                top: "44px",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                border: "1px solid #E2E8F0",
                width: "190px",
                padding: "6px",
                zIndex: 50,
              }}>
                {user?.role === "admin" && (
                  <button
                    onClick={() => { router.push("/admin"); setShowUserMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#F59E0B", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <ShieldCheck size={15} />
                    <span>Admin Panel</span>
                  </button>
                )}
                <button
                  onClick={() => { router.push("/profile"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <User size={15} />
                  <span>Profile & Resume</span>
                </button>
                <button
                  onClick={() => { router.push("/interview-sessions"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <ListChecks size={15} />
                  <span>My Prep Sessions</span>
                </button>
                <div style={{ height: "1px", backgroundColor: "#E2E8F0", margin: "4px 0" }} />
                <button
                  onClick={handleLogout}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay & Sidebar */}
      {mobileDrawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setMobileDrawerOpen(false)} />
          <div className="drawer-content">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                }}>
                  P
                </div>
                <span style={{ fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                  Prep<span style={{ color: "#2563EB" }}>CV</span>
                </span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, overflowY: "auto" }}>
              {renderNavLinks(true)}
            </div>

            <div style={{ padding: "14px 16px", borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
              <button
                onClick={handleLogout}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "6px", color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Body with Desktop Sidebar */}
      <div style={{ display: "flex", flex: 1, width: "100%" }}>
        
        {/* Left Navigation Sidebar (Desktop only) */}
        <aside className="hide-on-mobile" style={{
          width: "230px",
          backgroundColor: "#FFFFFF",
          borderRight: "1px solid #E2E8F0",
          padding: "24px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flexShrink: 0,
        }}>
          {renderNavLinks(false)}

          <div style={{ marginTop: "auto", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} color="#7C3AED" />
              <span>PrepCV Pro Tips</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
              Paste your target JD in ATS Check and Interview Prep to generate tailored answers.
            </div>
          </div>
        </aside>

        {/* Right Content Area (Responsive width & padding) */}
        <main style={{ flex: 1, minWidth: 0, padding: "clamp(16px, 3vw, 36px)", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" }}>
          <div className="responsive-modal-card">
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <HelpCircle size={20} color="#2563EB" />
              <span>PrepCV AI Preparation Guide</span>
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

