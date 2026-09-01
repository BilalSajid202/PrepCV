"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  ToggleLeft,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  User,
  ChevronDown,
  Sliders,
} from "lucide-react";

const adminNavItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "User Management", href: "/admin/users", icon: Users },
  { label: "Feature Controls", href: "/admin/features", icon: ToggleLeft },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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

  const renderNavLinks = (isDrawer = false) => (
    <>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", padding: "0 14px 6px 14px", letterSpacing: "0.05em" }}>
        Admin Menu
      </div>

      {adminNavItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
        const IconComponent = item.icon;
        return (
          <button
            key={item.href}
            onClick={() => {
              router.push(item.href);
              if (isDrawer) setMobileDrawerOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
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
              width: "100%",
            }}
          >
            <IconComponent size={17} color={isActive ? "#2563EB" : "#64748B"} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </>
  );

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
            aria-label="Open Admin Menu"
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
            onClick={() => router.push("/admin")}
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
            <span style={{
              fontSize: "10.5px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              border: "1px solid #BFDBFE",
              padding: "2px 6px",
              borderRadius: "10px",
              fontWeight: 700,
              marginLeft: "2px",
              letterSpacing: "0.02em",
            }}>
              ADMIN
            </span>
          </div>
        </div>

        {/* Right: Actions & User Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "6px 10px",
              fontSize: "12.5px",
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
            <ArrowLeft size={14} />
            <span className="hide-on-mobile">Back to App</span><span className="show-on-mobile">App</span>
          </button>

          <div className="hide-on-mobile" style={{ height: "24px", width: "1px", backgroundColor: "#E2E8F0" }} />

          {/* User Profile Dropdown */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: "6px",
              }}
            >
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "13px",
              }}>
                {user.full_name ? user.full_name[0].toUpperCase() : "A"}
              </div>
              <div className="hide-on-mobile" style={{ textAlign: "left" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: "10.5px", color: "#2563EB", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <ShieldCheck size={11} color="#2563EB" />
                  <span>Administrator</span>
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
                <button
                  onClick={() => { router.push("/dashboard"); setShowUserMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "4px", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <User size={15} />
                  <span>Candidate Dashboard</span>
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
                  Prep<span style={{ color: "#2563EB" }}>CV</span> Admin
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

            <div style={{ padding: "14px 16px", borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => { router.push("/dashboard"); setMobileDrawerOpen(false); }}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "#FFFFFF", border: "1px solid #E2E8F0", fontSize: "13px", cursor: "pointer", borderRadius: "6px", color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
              >
                <User size={15} />
                <span>Candidate App</span>
              </button>
              <button
                onClick={handleLogout}
                style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", fontSize: "13px", cursor: "pointer", borderRadius: "6px", color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Body */}
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

          <div style={{ marginTop: "auto", padding: "14px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders size={14} color="#2563EB" />
              <span>Admin Controls</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748B", lineHeight: 1.4 }}>
              Enable/deny features per candidate or update platform global feature switches.
            </div>
          </div>
        </aside>

        {/* Right Content Area (Responsive width & padding) */}
        <main style={{ flex: 1, minWidth: 0, padding: "clamp(16px, 3vw, 36px)", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
