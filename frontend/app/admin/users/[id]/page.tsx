"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAdminUserDetail,
  fetchFeatures,
  toggleUserFeature,
  updateUserRole,
  updateUserStatus,
  UserAdminResponse,
  FeatureResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Ban,
  UserCheck,
  UserX,
  FileText,
  MessageSquare,
  ListChecks,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const router = useRouter();

  const [user, setUser] = useState<UserAdminResponse | null>(null);
  const [allFeatures, setAllFeatures] = useState<FeatureResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userData, featuresData] = await Promise.all([
        fetchAdminUserDetail(userId),
        fetchFeatures(),
      ]);
      setUser(userData);
      setAllFeatures(featuresData);
    } catch (err: any) {
      setError(err.message || "Failed to load user details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleToggleFeature = async (featureId: string, currentEnabled: boolean) => {
    try {
      setToggleLoading(featureId);
      const newEnabled = !currentEnabled;
      await toggleUserFeature(userId, featureId, newEnabled);

      // Refresh user details to get updated features list
      const updatedUser = await fetchAdminUserDetail(userId);
      setUser(updatedUser);
      showNotification(`Feature ${newEnabled ? "enabled" : "revoked"} successfully.`);
    } catch (err: any) {
      alert(`Failed to toggle feature: ${err.message}`);
    } finally {
      setToggleLoading(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    try {
      const newStatus = !user.is_active;
      const updated = await updateUserStatus(user.id, newStatus);
      setUser(updated);
      showNotification(`User ${newStatus ? "activated" : "suspended"} successfully.`);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleToggleRole = async () => {
    if (!user) return;
    const newRole = user.role === "admin" ? "user" : "admin";
    if (newRole === "user") {
      if (!confirm(`Are you sure you want to demote ${user.full_name} from admin?`)) return;
    } else {
      if (!confirm(`Are you sure you want to promote ${user.full_name} to admin?`)) return;
    }

    try {
      const updated = await updateUserRole(user.id, newRole);
      setUser(updated);
      showNotification(`User role changed to ${newRole}.`);
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "#64748B" }}>
        Loading candidate profile...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "12px", padding: "24px", color: "#991B1B" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px 0" }}>Error Loading Candidate</h3>
        <p style={{ fontSize: "14px", margin: "0 0 16px 0" }}>{error || "User record not found"}</p>
        <button
          onClick={() => router.push("/admin/users")}
          style={{ background: "#2563EB", color: "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Candidate List</span>
        </button>
      </div>
    );
  }

  const enabledFeatureIds = new Set(
    user.features.filter((f) => f.is_enabled).map((f) => f.feature_id)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Top Breadcrumb & Notification */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => router.push("/admin/users")}
          style={{
            background: "none", border: "none", color: "#2563EB",
            fontSize: "13.5px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Candidates</span>
        </button>

        {successMsg && (
          <div style={{
            backgroundColor: "#DCFCE7", border: "1px solid #86EFAC",
            color: "#15803D", padding: "6px 14px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px"
          }}>
            <Check size={14} />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* User Header Profile Card */}
      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        padding: "28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: user.role === "admin" ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
            color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "22px", flexShrink: 0,
          }}>
            {user.full_name ? user.full_name[0].toUpperCase() : "U"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
                {user.full_name}
              </h1>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px",
                backgroundColor: user.role === "admin" ? "#FEF3C7" : "#EFF6FF",
                color: user.role === "admin" ? "#D97706" : "#2563EB",
                display: "inline-flex", alignItems: "center", gap: "4px",
              }}>
                {user.role === "admin" && <ShieldCheck size={11} />}
                <span>{user.role.toUpperCase()}</span>
              </span>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px",
                backgroundColor: user.is_active ? "#DCFCE7" : "#FEE2E2",
                color: user.is_active ? "#15803D" : "#DC2626",
              }}>
                {user.is_active ? "ACTIVE" : "SUSPENDED"}
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "#64748B", wordBreak: "break-word" }}>
              {user.email} · Registered on {new Date(user.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleToggleRole}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #CBD5E1",
              color: "#334155",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
          </button>

          <button
            onClick={handleToggleStatus}
            style={{
              backgroundColor: user.is_active ? "#FEE2E2" : "#DCFCE7",
              border: `1px solid ${user.is_active ? "#FCA5A5" : "#86EFAC"}`,
              color: user.is_active ? "#DC2626" : "#15803D",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {user.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
            <span>{user.is_active ? "Suspend Account" : "Activate Account"}</span>
          </button>
        </div>
      </div>

      {/* Activity Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
        <div style={{
          backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: "14px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>
            <FileText size={15} color="#16A34A" />
            <span>Resumes Created</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#16A34A", letterSpacing: "-0.02em" }}>{user.activity.resumes_count}</div>
        </div>
        <div style={{
          backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: "14px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>
            <ListChecks size={15} color="#2563EB" />
            <span>Interview Sessions</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#2563EB", letterSpacing: "-0.02em" }}>{user.activity.interview_sessions_count}</div>
        </div>
        <div style={{
          backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: "14px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>
            <MessageSquare size={15} color="#7C3AED" />
            <span>Feedbacks Shared</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#7C3AED", letterSpacing: "-0.02em" }}>{user.activity.interview_feedbacks_count}</div>
        </div>
      </div>

      {/* Feature Access Management Section */}
      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        padding: "26px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ marginBottom: "22px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0", letterSpacing: "-0.01em" }}>
            Candidate Feature Entitlements
          </h2>
          <p style={{ fontSize: "13.5px", color: "#64748B", margin: 0 }}>
            {user.role === "admin"
              ? "This user is an Administrator and has full access to all platform features automatically."
              : "Toggle specific feature switches to grant or deny access for this candidate account."}
          </p>
        </div>

        {allFeatures.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#94A3B8" }}>
            No features registered in system. Go to <a href="/admin/features" style={{ color: "#2563EB" }}>Features</a> to create one.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            {allFeatures.map((feat) => {
              const isEnabled = user.role === "admin" || enabledFeatureIds.has(feat.id);
              const isBusy = toggleLoading === feat.id;

              return (
                <div
                  key={feat.id}
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: `1px solid ${isEnabled ? "#BFDBFE" : "#E2E8F0"}`,
                    borderRadius: "12px",
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <div>
                        <span style={{ fontSize: "14.5px", fontWeight: 700, color: "#0F172A" }}>
                          {feat.name}
                        </span>
                        <div style={{ fontSize: "11px", color: "#2563EB", fontFamily: "monospace" }}>
                          {feat.key}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span style={{
                        fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "8px",
                        backgroundColor: isEnabled ? "#DCFCE7" : "#F1F5F9",
                        color: isEnabled ? "#15803D" : "#64748B",
                      }}>
                        {isEnabled ? "ENABLED" : "DENIED"}
                      </span>
                    </div>

                    <p style={{ fontSize: "12.5px", color: "#64748B", margin: 0, lineHeight: 1.4 }}>
                      {feat.description || "No description provided."}
                    </p>
                  </div>

                  {/* Toggle Button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                      Platform: {feat.is_active ? "Active" : "Disabled globally"}
                    </span>

                    {user.role === "admin" ? (
                      <span style={{ fontSize: "11px", color: "#D97706", fontWeight: 600 }}>
                        Admin Auto-Granted
                      </span>
                    ) : (
                      <button
                        disabled={isBusy}
                        onClick={() => handleToggleFeature(feat.id, isEnabled)}
                        style={{
                          backgroundColor: isEnabled ? "#FEE2E2" : "#2563EB",
                          color: isEnabled ? "#DC2626" : "#FFFFFF",
                          border: isEnabled ? "1px solid #FCA5A5" : "none",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isBusy ? "Updating..." : isEnabled ? "Revoke Access" : "Grant Access"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
