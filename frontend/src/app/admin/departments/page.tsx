"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { departmentsApi, Department } from "@/lib/api";

import ConfirmModal from "@/components/ConfirmModal";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [togglingDept, setTogglingDept] = useState<Department | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = () => {
    departmentsApi.listAll()
      .then(setDepartments)
      .catch((err) => setError(err.message || "Failed to load departments"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await departmentsApi.create({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName("");
      setNewDesc("");
      setShowAdd(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!togglingDept) return;
    setToggling(true);
    try {
      await departmentsApi.update(togglingDept.id, { is_active: !togglingDept.is_active });
      setTogglingDept(null);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to update department.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage organization departments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Add Department</button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New Department</h2>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Department Name *</label>
              <input className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !newName.trim()}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Add Department"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept.id}>
                  <td style={{ fontWeight: 500 }}>{dept.name}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{dept.description || "—"}</td>
                  <td>
                    <span className={`badge ${dept.is_active ? "badge-active" : "badge-inactive"}`}>
                      {dept.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setTogglingDept(dept)}
                    >
                      {dept.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(togglingDept)}
        title={togglingDept?.is_active ? "Deactivate Department" : "Activate Department"}
        message={
          <>
            Are you sure you want to {togglingDept?.is_active ? "deactivate" : "activate"} the <strong>{togglingDept?.name}</strong> department?
          </>
        }
        confirmLabel={togglingDept?.is_active ? "Deactivate" : "Activate"}
        isDanger={togglingDept?.is_active}
        loading={toggling}
        onConfirm={handleConfirmToggle}
        onCancel={() => setTogglingDept(null)}
      />
    </AppShell>
  );
}
