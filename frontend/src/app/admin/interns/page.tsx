"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { internsApi, departmentsApi, adminApi, InternProfile, Department, ManagerRef, ApiError } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

import ConfirmModal from "@/components/ConfirmModal";
import BulkUploadModal from "@/components/BulkUploadModal";

export default function AdminInternsPage() {
  const { user } = useAuth();
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<ManagerRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");

  // Deactivate confirmation state
  const [deactivatingIntern, setDeactivatingIntern] = useState<InternProfile | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Multi-select & Delete state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [deletingIntern, setDeletingIntern] = useState<InternProfile | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const fetchInterns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await internsApi.list({
        search: search || undefined,
        department_id: deptFilter || undefined,
        status: statusFilter || undefined,
        manager_id: managerFilter || undefined,
      });
      setInterns(data);
    } catch (e: any) {
      if (e?.status !== 401) console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, search, deptFilter, statusFilter, managerFilter]);

  useEffect(() => {
    if (!user) return;
    Promise.all([departmentsApi.list(), adminApi.managers()])
      .then(([d, m]) => { setDepartments(d); setManagers(m); })
      .catch((e: any) => { if (e?.status !== 401) console.error(e); });
    fetchInterns();
  }, [user, fetchInterns]);

  const toggleSelectAll = () => {
    if (selectedUserIds.size === interns.length && interns.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(interns.map((i) => i.user_id)));
    }
  };

  const toggleSelectOne = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingIntern) return;
    setDeactivating(true);
    try {
      await internsApi.deactivate(deactivatingIntern.user_id);
      setDeactivatingIntern(null);
      fetchInterns();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate intern.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!deletingIntern) return;
    if (confirmEmailInput.trim().toLowerCase() !== deletingIntern.company_email.trim().toLowerCase()) {
      alert("Email address does not match. Please enter the exact email to confirm deletion.");
      return;
    }
    setIsSubmittingDelete(true);
    try {
      await internsApi.deletePermanent(deletingIntern.user_id);
      setDeletingIntern(null);
      setConfirmEmailInput("");
      setSelectedUserIds((prev) => {
        const copy = new Set(prev);
        copy.delete(deletingIntern.user_id);
        return copy;
      });
      fetchInterns();
    } catch (err: any) {
      alert(err.message || "Failed to delete intern.");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;
    setIsSubmittingDelete(true);
    try {
      await adminApi.bulkDelete(Array.from(selectedUserIds));
      setShowBulkDeleteModal(false);
      setSelectedUserIds(new Set());
      fetchInterns();
    } catch (err: any) {
      alert(err.message || "Failed to delete selected interns.");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Intern Management</h1>
          <p className="page-subtitle">{interns.length} intern{interns.length !== 1 ? "s" : ""} found</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button id="btn-bulk-import" type="button" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowBulkModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Bulk Import
          </button>
          <Link href="/admin/interns/add" className="btn btn-primary">
            + Add Intern
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper" style={{ maxWidth: 300 }}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/></svg>
          <input
            id="intern-search"
            type="text"
            className="form-input search-input"
            placeholder="Search name, email, TK ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select id="dept-filter" className="form-select" style={{ width: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select id="status-filter" className="form-select" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ALUMNI">Alumni</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select id="manager-filter" className="form-select" style={{ width: 180 }} value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
          <option value="">All Managers</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {/* Floating Multi-Select Action Bar */}
      {selectedUserIds.size > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "10px 16px",
          marginBottom: 16,
          boxShadow: "var(--shadow-md)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", display: "flex", alignItems: "center" }}>
            <span style={{
              background: "var(--color-primary)",
              color: "#fff",
              padding: "2px 10px",
              borderRadius: 12,
              marginRight: 10,
              fontSize: 13,
              fontWeight: 700,
            }}>
              {selectedUserIds.size}
            </span>
            intern{selectedUserIds.size > 1 ? "s" : ""} selected
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedUserIds(new Set())}
            >
              Deselect All
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ color: "var(--color-danger)", borderColor: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Delete Selected ({selectedUserIds.size})
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : interns.length === 0 ? (
        <div className="empty-state">
          <UsersIcon />
          <h3>No interns found</h3>
          <p>Try adjusting your filters or add a new intern.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                    checked={interns.length > 0 && selectedUserIds.size === interns.length}
                    onChange={toggleSelectAll}
                    title="Select All"
                  />
                </th>
                <th>Name</th>
                <th>Company Email</th>
                <th>TK ID</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Joining</th>
                <th>End Date</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interns.map((intern) => (
                <tr key={intern.id}>
                  <td style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                      checked={selectedUserIds.has(intern.user_id)}
                      onChange={() => toggleSelectOne(intern.user_id)}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>
                        {intern.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontWeight: 500 }}>{intern.full_name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--color-text-muted)", fontFamily: "monospace", fontSize: 13 }}>
                    {intern.company_email}
                  </td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                    {intern.new_tk_id || "—"}
                  </td>
                  <td>{intern.department?.name || "—"}</td>
                  <td>{intern.reporting_manager?.full_name || "—"}</td>
                  <td>{formatDate(intern.joining_date)}</td>
                  <td>{formatDate(intern.end_date)}</td>
                  <td><StatusBadge status={intern.status} /></td>
                  <td style={{ textAlign: "center" }}>
                    <ActionDropdown
                      intern={intern}
                      onDeactivate={() => setDeactivatingIntern(intern)}
                      onDelete={() => {
                        setConfirmEmailInput("");
                        setDeletingIntern(intern);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivate Modal */}
      <ConfirmModal
        isOpen={Boolean(deactivatingIntern)}
        title="Deactivate Intern"
        message={
          <>
            Are you sure you want to deactivate <strong>{deactivatingIntern?.full_name}</strong>?
            This will mark their account as inactive and disable system access.
          </>
        }
        confirmLabel="Deactivate Account"
        isDanger={true}
        loading={deactivating}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivatingIntern(null)}
      />

      {/* Single Permanent Delete Modal */}
      {Boolean(deletingIntern) && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingIntern(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 className="modal-title" style={{ color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Permanently Delete Intern
              </h2>
              <button type="button" onClick={() => setDeletingIntern(null)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="alert alert-danger" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Warning:</strong> This action cannot be undone. Permanently deleting <strong>{deletingIntern?.full_name}</strong> will remove their user account, intern profile, assigned tasks, and records.
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 13 }}>
                  To confirm, type <strong>{deletingIntern?.company_email}</strong> below:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={deletingIntern?.company_email}
                  value={confirmEmailInput}
                  onChange={(e) => setConfirmEmailInput(e.target.value)}
                  style={{ fontFamily: "monospace", marginTop: 6 }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeletingIntern(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={confirmEmailInput.trim().toLowerCase() !== deletingIntern?.company_email.trim().toLowerCase() || isSubmittingDelete}
                onClick={handleConfirmSingleDelete}
              >
                {isSubmittingDelete ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Safeguard Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowBulkDeleteModal(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 className="modal-title" style={{ color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete Selected Interns
              </h2>
              <button type="button" onClick={() => setShowBulkDeleteModal(false)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="alert alert-danger" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Warning:</strong> You are about to permanently delete <strong>{selectedUserIds.size} intern account{selectedUserIds.size > 1 ? "s" : ""}</strong>. All associated tasks, handovers, and profile data will be permanently purged from the database.
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                Are you sure you want to proceed with this batch deletion?
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isSubmittingDelete}
                onClick={handleConfirmBulkDelete}
              >
                {isSubmittingDelete ? "Deleting Batch…" : `Delete ${selectedUserIds.size} Interns`}
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={fetchInterns}
      />
    </AppShell>
  );
}

function ActionDropdown({
  intern,
  onDeactivate,
  onDelete,
}: {
  intern: InternProfile;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
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
        aria-label="Actions menu"
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
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = "var(--color-surface-2)";
            e.currentTarget.style.color = "var(--color-text)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-dim)";
          }
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
            width: 145,
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
          <Link
            href={`/admin/interns/${intern.user_id}`}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>
            View
          </Link>
          <Link
            href={`/admin/interns/${intern.user_id}/edit`}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </Link>
          {intern.status !== "INACTIVE" && (
            <button
              type="button"
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--color-warning, #f59e0b)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
              }}
              onClick={() => {
                setOpen(false);
                onDeactivate();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><circle cx={12} cy={12} r={10}/><line x1={15} y1={9} x2={9} y2={15}/></svg>
              Deactivate
            </button>
          )}
          <button
            type="button"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--color-danger)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Delete Intern
          </button>
        </div>
      )}
    </div>
  );
}

function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>; }
