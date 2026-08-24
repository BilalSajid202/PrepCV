"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/protected-route";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

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
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "36px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700
              }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Welcome back, {user?.full_name}!
                </h1>
                <p style={{ fontSize: "14px", color: "#64748B", margin: "4px 0 0 0" }}>
                  Candidate Account ({user?.email})
                </p>
              </div>
            </div>

            <div style={{
              marginTop: "24px",
              padding: "20px",
              borderRadius: "8px",
              backgroundColor: "#F1F5F9",
              border: "1px solid #E2E8F0"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "8px" }}>
                ✦ Authentication Status: Verified
              </h3>
              <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.5, margin: 0 }}>
                Your JWT session is active and persisted. Hitting protected routes without authorization automatically redirects to the login screen. Refreshing the browser keeps your session intact.
              </p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
