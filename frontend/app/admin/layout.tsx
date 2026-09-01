"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const adminNavItems = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "User Management", href: "/admin/users", icon: "👥" },
  { label: "Feature Controls", href: "/admin/features", icon: "⚡" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace("/login");
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", backgroundColor: "#F8FAFC",
        color: "#64748B", fontSize: "15px", fontWeight: 500,
        fontFamily: "'Inter', sans-serif",
      }}>
        Loading admin workspace...
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#F8FAFC",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
      color: "#0F172A",
    }}>

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            onClick={() => router.push("/admin")}
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
            <span style={{
              fontSize: "11px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              border: "1px solid #BFDBFE",
              padding: "2px 8px",
              borderRadius: "10px",
              fontWeight: 700,
              marginLeft: "4px",
              letterSpacing: "0.02em",
            }}>
              ADMIN PANEL
            </span>
          </div>
        </div>

        {/* Right: Actions & User Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
          >
            <span>←</span> Back to Candidate App
          </button>

          <div style={{ height: "24px", width: "1px", backgroundColor: "#E2E8F0" }} />

          {/* User Profile Dropdown */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
            >
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
              }}>
                {user.full_name ? user.full_name[0].toUpperCase() : "A"}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: "11px", color: "#2563EB", fontWeight: 600 }}>
                  🛡️ Administrator
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
                width: "190px",
                padding: "6px",
                zIndex: 50,
              }}>
                <button
                  onClick={() => { router.push("/dashboard"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155" }}
                >
                  👤 Candidate Dashboard
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

      {/* Main Body */}
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
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", padding: "0 14px 6px 14px", letterSpacing: "0.05em" }}>
            Admin Menu
          </div>

          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isActive ? "#EFF6FF" : "transparent",
                  color: isActive ? "#2563EB" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.15s ease",
                }}
              >
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div style={{ marginTop: "auto", padding: "14px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>🛡️ Admin Controls</div>
            <div style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
              Enable/deny features per candidate or update platform global feature switches.
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, padding: "32px 40px", maxWidth: "1200px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
