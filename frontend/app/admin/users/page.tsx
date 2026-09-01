"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAdminUsers,
  updateUserRole,
  updateUserStatus,
  UserAdminResponse,
} from "@/lib/api";
import {
  Search,
  X,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserAdminResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limit = 15;

  const loadUsers = async (p = page, q = search) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminUsers(q, p, limit);
      setUsers(res.users);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || "Failed to load users list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(page, search);
  }, [page, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleToggleStatus = async (user: UserAdminResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(user.id);
      const newStatus = !user.is_active;
      await updateUserStatus(user.id, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
      );
    } catch (err: any) {
      alert(`Failed to update user status: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (user: UserAdminResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRole = user.role === "admin" ? "user" : "admin";
    if (newRole === "user") {
      if (!confirm(`Are you sure you want to demote ${user.full_name} from admin?`)) return;
    } else {
      if (!confirm(`Are you sure you want to promote ${user.full_name} to admin?`)) return;
    }

    try {
      setActionLoading(user.id);
      await updateUserRole(user.id, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(`Failed to update user role: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 4px 0", color: "#0F172A", letterSpacing: "-0.02em" }}>
            Candidate & User Management
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
            {total} registered candidates & admins
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%", maxWidth: "420px" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: "180px" }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "9px 14px 9px 36px",
                color: "#0F172A",
                fontSize: "13.5px",
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                color: "#64748B",
                borderRadius: "8px",
                padding: "9px 14px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "14px", color: "#991B1B", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Users Table */}
      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th style={{ padding: "14px 20px", color: "#64748B", fontWeight: 600 }}>Candidate</th>
                <th style={{ padding: "14px 16px", color: "#64748B", fontWeight: 600 }}>Role</th>
                <th style={{ padding: "14px 16px", color: "#64748B", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "14px 16px", color: "#64748B", fontWeight: 600 }}>Feature Access</th>
                <th style={{ padding: "14px 16px", color: "#64748B", fontWeight: 600 }}>Activity</th>
                <th style={{ padding: "14px 16px", color: "#64748B", fontWeight: 600 }}>Joined</th>
                <th style={{ padding: "14px 20px", color: "#64748B", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                    Loading candidate records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                    No candidates found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const enabledFeaturesCount = u.features.filter((f) => f.is_enabled).length;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => router.push(`/admin/users/${u.id}`)}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      {/* Candidate Avatar & Details */}
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "36px", height: "36px", borderRadius: "50%",
                            backgroundColor: u.role === "admin" ? "#F59E0B" : "#2563EB",
                            color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "14px"
                          }}>
                            {u.full_name ? u.full_name[0].toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0F172A" }}>{u.full_name}</div>
                            <div style={{ fontSize: "12px", color: "#64748B" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "8px",
                          backgroundColor: u.role === "admin" ? "#FEF3C7" : "#EFF6FF",
                          color: u.role === "admin" ? "#D97706" : "#2563EB",
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "8px",
                          backgroundColor: u.is_active ? "#DCFCE7" : "#FEE2E2",
                          color: u.is_active ? "#15803D" : "#DC2626",
                        }}>
                          {u.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>

                      {/* Features */}
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          fontSize: "12.5px", color: u.role === "admin" ? "#D97706" : "#0F172A",
                          fontWeight: 600
                        }}>
                          {u.role === "admin" ? "All Features (Admin)" : `${enabledFeaturesCount} Active`}
                        </span>
                      </td>

                      {/* Activity */}
                      <td style={{ padding: "14px 16px", color: "#475569", fontSize: "12px" }}>
                        <div>{u.activity?.resumes_count || 0} resumes</div>
                        <div style={{ color: "#94A3B8", fontSize: "11px" }}>
                          {u.activity?.interview_sessions_count || 0} sessions
                        </div>
                      </td>

                      {/* Joined */}
                      <td style={{ padding: "14px 16px", color: "#64748B", fontSize: "12px" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            disabled={actionLoading === u.id}
                            onClick={(e) => handleToggleRole(u, e)}
                            title={u.role === "admin" ? "Demote to User" : "Promote to Admin"}
                            style={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #CBD5E1",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            {u.role === "admin" ? "Demote" : "Promote"}
                          </button>

                          <button
                            disabled={actionLoading === u.id}
                            onClick={(e) => handleToggleStatus(u, e)}
                            title={u.is_active ? "Suspend Account" : "Activate Account"}
                            style={{
                              backgroundColor: u.is_active ? "#FEE2E2" : "#DCFCE7",
                              border: `1px solid ${u.is_active ? "#FCA5A5" : "#86EFAC"}`,
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "11px",
                              color: u.is_active ? "#DC2626" : "#15803D",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 20px", backgroundColor: "#F8FAFC",
            borderTop: "1px solid #E2E8F0", fontSize: "12.5px", color: "#64748B"
          }}>
            <span>
              Page {page} of {totalPages} ({total} total candidates)
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  backgroundColor: "#FFFFFF",
                  color: page <= 1 ? "#94A3B8" : "#0F172A",
                  border: "1px solid #CBD5E1", borderRadius: "6px", padding: "6px 12px",
                  cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 500
                }}
              >
                ← Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  backgroundColor: "#FFFFFF",
                  color: page >= totalPages ? "#94A3B8" : "#0F172A",
                  border: "1px solid #CBD5E1", borderRadius: "6px", padding: "6px 12px",
                  cursor: page >= totalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 500
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
