"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { projectsApi, departmentsApi, Project, Department } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function ProjectsDirectoryPage() {
  const { user, isAdmin, isManager } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Create Project Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [statusVal, setStatusVal] = useState("ACTIVE");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [deptId, setDeptId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await projectsApi.list({
        status: statusFilter || undefined,
        department_id: deptFilter || undefined,
      });
      setProjects(data);
    } catch (e: any) {
      if (e?.status !== 401) console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, deptFilter]);

  useEffect(() => {
    if (!user) return;
    departmentsApi.list().then(setDepartments).catch(() => {});
    fetchProjects();
  }, [user, fetchProjects]);

  const openCreateModal = () => {
    setName("");
    setDescription("");
    setStatusVal("ACTIVE");
    setStartDate("");
    setTargetEndDate("");
    setDeptId(isManager && user?.department_id ? user.department_id : "");
    setCreateError("");
    setShowCreateModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        status: statusVal,
        start_date: startDate || undefined,
        target_end_date: targetEndDate || undefined,
        department_id: deptId || undefined,
      });
      setShowCreateModal(false);
      fetchProjects();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (st: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      COMPLETED: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
      ON_HOLD:   { label: "On Hold",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
      PLANNING:  { label: "Planning",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
      ACTIVE:    { label: "Active",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    };
    const s = map[st] || map.ACTIVE;
    return (
      <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
        {s.label}
      </span>
    );
  };

  // Delete Project state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleConfirmDeleteProject = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await projectsApi.delete(deletingProject.id);
      setDeletingProject(null);
      fetchProjects();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  };

  const basePath = isAdmin ? "/admin" : isManager ? "/manager" : "/intern";

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Project-based task assignment &amp; team tracking — {projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        {(isAdmin || isManager) && (
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <PlusIcon />
            Create Project
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PLANNING">Planning</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {isAdmin && (
          <select className="form-select" style={{ width: 180 }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderOpenIcon />
          <h3>No projects found</h3>
          <p>Create your first project to organize tasks and team assignments.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {projects.map((project) => {
            const percent = project.task_count > 0
              ? Math.round((project.completed_task_count / project.task_count) * 100)
              : 0;
            return (
              <div key={project.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--color-text)", lineHeight: 1.4 }}>
                      <Link href={`${basePath}/projects/${project.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {project.name}
                      </Link>
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>

                  {project.department && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <BuildingIcon />
                      {project.department.name}
                    </div>
                  )}

                  {project.description && (
                    <p style={{ fontSize: 13, color: "var(--color-text-dim)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Task progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, color: "var(--color-text-muted)" }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 600 }}>{project.completed_task_count}/{project.task_count} tasks</span>
                  </div>
                  <div style={{ height: 5, background: "var(--color-surface-2)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${percent}%`, background: percent === 100 ? "#10b981" : "var(--color-primary)", transition: "width 0.4s ease", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Footer: avatars + action */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {project.interns.slice(0, 4).map((intern, i) => (
                      <div key={intern.id} title={intern.full_name} style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, border: "2px solid var(--color-surface)", marginLeft: i > 0 ? -7 : 0, zIndex: 4 - i }}>
                        {intern.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                    ))}
                    {project.interns.length > 4 && (
                      <span style={{ fontSize: 11, color: "var(--color-text-dim)", marginLeft: 6 }}>+{project.interns.length - 4}</span>
                    )}
                    {project.interns.length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>No team assigned</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`${basePath}/projects/${project.id}`} className="btn btn-secondary btn-sm">
                      View →
                    </Link>
                    {(isAdmin || isManager) && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        title="Delete Project"
                        onClick={() => setDeletingProject(project)}
                        style={{ padding: "4px 8px" }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete Project Safeguard Modal ────────────────────────────────────── */}
      {deletingProject && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingProject(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 className="modal-title" style={{ color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete Project
              </h2>
              <button type="button" onClick={() => setDeletingProject(null)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>✕</button>
            </div>
            {deleteError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{deleteError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="alert alert-danger" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Warning:</strong> You are about to permanently delete project <strong>"{deletingProject.name}"</strong>. This will unassign team members and remove project associations from tasks.
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                Are you sure you want to proceed with deleting this project?
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeletingProject(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeleting}
                onClick={handleConfirmDeleteProject}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Project Modal ──────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="modal" style={{ maxWidth: 540 }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
                  <FolderPlusIcon />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>Create New Project</h2>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>Fill in the details to set up a new project</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProject}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Project Name <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Mobile App Redesign"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Brief scope, target deliverables, or tech stack…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ resize: "vertical", minHeight: 80 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={statusVal} onChange={(e) => setStatusVal(e.target.value)}>
                      <option value="ACTIVE">Active</option>
                      <option value="PLANNING">Planning</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Department</label>
                    {isAdmin ? (
                      <select className="form-select" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                        <option value="">None / Company-wide</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        value={departments.find((d) => d.id === deptId)?.name || "My Department"}
                        disabled
                        style={{ opacity: 0.85, cursor: "not-allowed" }}
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Target End Date</label>
                    <input type="date" className="form-input" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
                  </div>
                </div>

                {createError && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
                    {createError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
                  ) : (
                    <><PlusIcon /> Create Project</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function FolderOpenIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <polyline points="2 12 22 12" />
    </svg>
  );
}
function FolderPlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={7} width={20} height={14} rx={1} /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}
