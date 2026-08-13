"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { adminApi, departmentsApi, UserInfo, Department } from "@/lib/api";
import { StatusBadge } from "@/components/ui-utils";
import PasswordInput from "@/components/PasswordInput";

export default function ManagersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    company_email: "",
    full_name: "",
    role: "MANAGER",
    initial_password: "",
    department_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    company_email: "",
    role: "MANAGER",
    department_id: "",
    is_active: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = () => {
    Promise.all([
      adminApi.users(),
      departmentsApi.list(),
    ]).then(([u, d]) => {
      setUsers(u.filter((x) => x.role !== "INTERN"));
      setDepartments(d);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setError("");
    setSaving(true);
    try {
      await adminApi.createUser({
        ...form,
        department_id: form.department_id || undefined,
      });
      setShowCreate(false);
      setForm({ company_email: "", full_name: "", role: "MANAGER", initial_password: "", department_id: "" });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (u: UserInfo) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name,
      company_email: u.company_email,
      role: u.role,
      department_id: u.department_id || "",
      is_active: u.is_active,
    });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditError("");
    setEditSaving(true);
    try {
      await adminApi.updateUser(editingUser.id, {
        full_name: editForm.full_name.trim(),
        company_email: editForm.company_email.trim(),
        role: editForm.role,
        department_id: editForm.department_id || undefined,
        is_active: editForm.is_active,
      });
      setEditingUser(null);
      load();
    } catch (e: any) {
      setEditError(e.message || "Failed to update user.");
    } finally {
      setEditSaving(false);
    }
  };

  // Delete User State
  const [deletingUser, setDeletingUser] = useState<UserInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await adminApi.deleteUser(deletingUser.id);
      setDeletingUser(null);
      load();
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeptName = (deptId?: string) => {
    if (!deptId) return "—";
    const dept = departments.find((d) => d.id === deptId);
    return dept ? dept.name : "—";
  };

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage Admins and Managers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Add User</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Create Manager / Admin Account</h2>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full Name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Company Email *</label>
              <input className="form-input" type="email" value={form.company_email} onChange={(e) => setForm(f => ({ ...f, company_email: e.target.value }))} placeholder="name@talakunchi.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-select" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" value={form.department_id} onChange={(e) => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Initial Password</label>
              <PasswordInput value={form.initial_password} onChange={(e) => setForm(f => ({ ...f, initial_password: e.target.value }))} placeholder="Leave blank for Google SSO" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Create User"}
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: u.role === "ADMIN"
                          ? "linear-gradient(135deg, var(--color-accent), #a78bfa)"
                          : "linear-gradient(135deg, var(--color-primary), #60a5fa)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#fff",
                      }}>
                        {u.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-muted)" }}>{u.company_email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td><span className="badge badge-intern">{getDeptName(u.department_id)}</span></td>
                  <td><StatusBadge status={u.is_active ? "ACTIVE" : "INACTIVE"} /></td>
                  <td style={{ textAlign: "center" }}>
                    <UserActionsMenu
                      user={u}
                      onEdit={() => startEditing(u)}
                      onDelete={() => setDeletingUser(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Edit User Account</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>✕</button>
            </div>

            {editError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{editError}</div>}

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company Email *</label>
                <input
                  className="form-input"
                  type="email"
                  value={editForm.company_email}
                  onChange={(e) => setEditForm(f => ({ ...f, company_email: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-select"
                  value={editForm.role}
                  onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={editForm.department_id}
                  onChange={(e) => setEditForm(f => ({ ...f, department_id: e.target.value }))}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  Account is Active
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Safeguard Modal */}
      {deletingUser && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div className="card" style={{ width: "100%", maxWidth: 460, borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete User Account
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeletingUser(null)}>✕</button>
            </div>

            {deleteError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{deleteError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="alert alert-danger" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Warning:</strong> You are about to permanently delete <strong>{deletingUser.full_name}</strong> ({deletingUser.company_email}). This action will remove the account from the database.
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Are you sure you want to proceed with deleting this {deletingUser.role.toLowerCase()} account?
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setDeletingUser(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDeleteUser} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Three Dots Actions Menu ──────────────────────────────────────────────────
import { useRef } from "react";

function UserActionsMenu({ user, onEdit, onDelete }: { user: UserInfo; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", justifyContent: "center" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Actions"
        style={{
          background: open ? "var(--color-surface-2)" : "transparent",
          border: "none",
          color: open ? "var(--color-text)" : "var(--color-text-dim)",
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, display: "block" }}>
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 4,
            width: 140,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 100,
            padding: "4px 0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <button
            type="button"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--color-text)",
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit User
          </button>
          <button
            type="button"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              color: "#ef4444",
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
            onClick={() => { setOpen(false); onDelete(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete User
          </button>
        </div>
      )}
    </div>
  );
}
