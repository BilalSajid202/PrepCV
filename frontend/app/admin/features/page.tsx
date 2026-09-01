"use client";

import React, { useEffect, useState } from "react";
import {
  fetchFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  bulkAssignFeature,
  fetchAdminUsers,
  FeatureResponse,
} from "@/lib/api";
import {
  Plus,
  Trash2,
  Edit3,
  Sliders,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from "lucide-react";

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Modal State
  const [editingFeature, setEditingFeature] = useState<FeatureResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Bulk Assign Modal State
  const [bulkFeature, setBulkFeature] = useState<FeatureResponse | null>(null);
  const [bulkAction, setBulkAction] = useState<"enable" | "disable">("enable");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFeatures();
      setFeatures(data);
    } catch (err: any) {
      setError(err.message || "Failed to load features.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateSubmitting(true);
      await createFeature({ key: newKey, name: newName, description: newDesc });
      setShowCreateModal(false);
      setNewKey("");
      setNewName("");
      setNewDesc("");
      showNotification(`Feature '${newName}' registered successfully!`);
      await loadFeatures();
    } catch (err: any) {
      alert(`Error creating feature: ${err.message}`);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenEdit = (feat: FeatureResponse) => {
    setEditingFeature(feat);
    setEditName(feat.name);
    setEditDesc(feat.description);
    setEditActive(feat.is_active);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;
    try {
      setEditSubmitting(true);
      await updateFeature(editingFeature.id, {
        name: editName,
        description: editDesc,
        is_active: editActive,
      });
      setEditingFeature(null);
      showNotification(`Feature updated successfully!`);
      await loadFeatures();
    } catch (err: any) {
      alert(`Error updating feature: ${err.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleGlobalActive = async (feat: FeatureResponse) => {
    try {
      const newActive = !feat.is_active;
      await updateFeature(feat.id, { is_active: newActive });
      setFeatures((prev) =>
        prev.map((f) => (f.id === feat.id ? { ...f, is_active: newActive } : f))
      );
      showNotification(`Feature '${feat.name}' is now ${newActive ? "Active" : "Disabled Globally"}.`);
    } catch (err: any) {
      alert(`Error toggling status: ${err.message}`);
    }
  };

  const handleDelete = async (feat: FeatureResponse) => {
    if (!confirm(`Are you sure you want to delete feature '${feat.name}'? All user assignments will be removed.`)) return;
    try {
      await deleteFeature(feat.id);
      setFeatures((prev) => prev.filter((f) => f.id !== feat.id));
      showNotification(`Feature '${feat.name}' deleted.`);
    } catch (err: any) {
      alert(`Error deleting feature: ${err.message}`);
    }
  };

  const handleBulkAssignToAll = async () => {
    if (!bulkFeature) return;
    try {
      setBulkSubmitting(true);
      // Fetch all users
      const usersRes = await fetchAdminUsers(undefined, 1, 1000);
      const allUserIds = usersRes.users.map((u) => u.id);

      if (allUserIds.length === 0) {
        alert("No users found to assign.");
        return;
      }

      const isEnable = bulkAction === "enable";
      await bulkAssignFeature(bulkFeature.id, allUserIds, isEnable);
      setBulkFeature(null);
      showNotification(
        `Feature '${bulkFeature.name}' has been ${isEnable ? "granted" : "revoked"} for all ${allUserIds.length} users!`
      );
      await loadFeatures();
    } catch (err: any) {
      alert(`Bulk assignment failed: ${err.message}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 4px 0", color: "#0F172A", letterSpacing: "-0.02em" }}>
            Feature Management & Killswitches
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
            Register new platform features, toggle global switches, or bulk-assign to candidates.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {successMsg && (
            <div style={{
              backgroundColor: "#DCFCE7", border: "1px solid #86EFAC",
              color: "#15803D", padding: "6px 14px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px"
            }}>
              <Check size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
            }}
          >
            <Plus size={16} />
            <span>Add New Feature</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "14px", color: "#991B1B", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Features Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>Loading features...</div>
      ) : features.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>No features configured yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {features.map((feat) => (
            <div
              key={feat.id}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {/* Header Info */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0", color: "#0F172A" }}>
                      {feat.name}
                    </h3>
                    <code style={{ fontSize: "11.5px", color: "#2563EB", backgroundColor: "#EFF6FF", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                      {feat.key}
                    </code>
                  </div>

                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "8px",
                    backgroundColor: feat.is_active ? "#DCFCE7" : "#FEE2E2",
                    color: feat.is_active ? "#15803D" : "#DC2626",
                  }}>
                    {feat.is_active ? "ACTIVE" : "OFF"}
                  </span>
                </div>

                <p style={{ fontSize: "13px", color: "#64748B", margin: "10px 0 0 0", lineHeight: 1.5 }}>
                  {feat.description || "No description provided."}
                </p>
              </div>

              {/* Stats & Actions */}
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "8px",
                  border: "1px solid #E2E8F0", marginBottom: "14px", fontSize: "12.5px"
                }}>
                  <span style={{ color: "#64748B" }}>Active Entitled Users:</span>
                  <span style={{ fontWeight: 700, color: "#2563EB" }}>{feat.assigned_users_count} users</span>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleToggleGlobalActive(feat)}
                    style={{
                      flex: 1,
                      backgroundColor: feat.is_active ? "#FEE2E2" : "#DCFCE7",
                      border: `1px solid ${feat.is_active ? "#FCA5A5" : "#86EFAC"}`,
                      borderRadius: "6px", padding: "7px 10px", fontSize: "11.5px",
                      fontWeight: 600, color: feat.is_active ? "#DC2626" : "#15803D", cursor: "pointer"
                    }}
                  >
                    {feat.is_active ? "Disable Killswitch" : "Enable Feature"}
                  </button>

                  <button
                    onClick={() => { setBulkFeature(feat); setBulkAction("enable"); }}
                    style={{
                      backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE",
                      borderRadius: "6px", padding: "7px 12px", fontSize: "11.5px",
                      fontWeight: 600, color: "#2563EB", cursor: "pointer"
                    }}
                  >
                    Bulk Assign
                  </button>

                  <button
                    onClick={() => handleOpenEdit(feat)}
                    style={{
                      backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                      borderRadius: "6px", padding: "7px 12px", fontSize: "11.5px",
                      fontWeight: 600, color: "#334155", cursor: "pointer"
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(feat)}
                    title="Delete Feature"
                    style={{
                      backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                      borderRadius: "6px", padding: "7px 10px", fontSize: "11.5px",
                      color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center"
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE FEATURE MODAL */}
      {showCreateModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px"
        }}>
          <div className="responsive-modal-card" style={{
            backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "14px", color: "#0F172A",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>Register New Feature</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Feature Key (e.g. mock_interview)
                </label>
                <input
                  type="text"
                  required
                  placeholder="mock_interview"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "9px 12px", color: "#0F172A", fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mock Interview Simulator"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "9px 12px", color: "#0F172A", fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provides AI simulated live voice interviews for candidates..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "9px 12px", color: "#0F172A", fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    backgroundColor: "#FFFFFF", color: "#475569", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  style={{
                    backgroundColor: "#2563EB", color: "#FFFFFF",
                    border: "none", borderRadius: "6px", padding: "8px 18px", cursor: "pointer",
                    fontSize: "13px", fontWeight: 600
                  }}
                >
                  {createSubmitting ? "Creating..." : "Create Feature"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FEATURE MODAL */}
      {editingFeature && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px"
        }}>
          <div className="responsive-modal-card" style={{
            backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "14px", color: "#0F172A",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>Edit Feature: {editingFeature.key}</h2>
            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "9px 12px", color: "#0F172A", fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{
                    width: "100%", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "9px 12px", color: "#0F172A", fontSize: "13px", boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <label htmlFor="activeCheck" style={{ fontSize: "13px", color: "#334155", fontWeight: 500 }}>
                  Globally Active (enabled for entitled users)
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setEditingFeature(null)}
                  style={{
                    backgroundColor: "#FFFFFF", color: "#475569", border: "1px solid #CBD5E1",
                    borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontSize: "13px"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  style={{
                    backgroundColor: "#2563EB", color: "#FFFFFF",
                    border: "none", borderRadius: "6px", padding: "8px 18px", cursor: "pointer",
                    fontSize: "13px", fontWeight: 600
                  }}
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ASSIGN MODAL */}
      {bulkFeature && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px"
        }}>
          <div className="responsive-modal-card" style={{
            backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: "14px", color: "#0F172A",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>
              Bulk Assign: {bulkFeature.name}
            </h2>
            <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 18px 0" }}>
              Grant or revoke access to this feature across all candidate user accounts.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <label style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px",
                backgroundColor: bulkAction === "enable" ? "#EFF6FF" : "#F8FAFC",
                border: `1px solid ${bulkAction === "enable" ? "#2563EB" : "#E2E8F0"}`,
                borderRadius: "8px", cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="bulkAction"
                  value="enable"
                  checked={bulkAction === "enable"}
                  onChange={() => setBulkAction("enable")}
                />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>Grant to ALL Candidates</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Enable this feature for all registered candidates</div>
                </div>
              </label>

              <label style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "12px",
                backgroundColor: bulkAction === "disable" ? "#FEF2F2" : "#F8FAFC",
                border: `1px solid ${bulkAction === "disable" ? "#DC2626" : "#E2E8F0"}`,
                borderRadius: "8px", cursor: "pointer"
              }}>
                <input
                  type="radio"
                  name="bulkAction"
                  value="disable"
                  checked={bulkAction === "disable"}
                  onChange={() => setBulkAction("disable")}
                />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>Revoke from ALL Candidates</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Disable this feature for all registered candidates</div>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setBulkFeature(null)}
                style={{
                  backgroundColor: "#FFFFFF", color: "#475569", border: "1px solid #CBD5E1",
                  borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontSize: "13px"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={handleBulkAssignToAll}
                style={{
                  backgroundColor: bulkAction === "enable" ? "#2563EB" : "#DC2626",
                  color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 18px",
                  cursor: "pointer", fontSize: "13px", fontWeight: 600
                }}
              >
                {bulkSubmitting ? "Applying..." : "Apply Bulk Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
