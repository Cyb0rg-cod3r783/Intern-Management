"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { projectsApi, internsApi, tasksApi, Project, InternProfile, Task } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    COMPLETED:   { label: "Completed",   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    IN_PROGRESS: { label: "In Progress", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    NOT_STARTED: { label: "Not Started", color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
    BLOCKED:     { label: "Blocked",     color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const s = map[status] || { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    HIGH:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    MEDIUM: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    LOW:    { color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  };
  const s = map[priority] || map.MEDIUM;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {priority}
    </span>
  );
}

export default function ProjectDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { isAdmin, isManager } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [allInterns, setAllInterns] = useState<InternProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign Interns Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Add Task Modal
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskInternId, setTaskInternId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  // Delete Project Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [pData, tData] = await Promise.all([
        projectsApi.get(id),
        projectsApi.getTasks(id),
      ]);
      setProject(pData);
      setProjectTasks(tData);
      setSelectedUserIds(new Set(pData.interns.map((i) => i.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  useEffect(() => {
    if ((isAdmin || isManager) && project) {
      const targetDeptId = project.department?.id || project.department_id;
      internsApi.list(targetDeptId ? { department_id: targetDeptId } : undefined)
        .then(setAllInterns)
        .catch(() => {});
    }
  }, [project, isAdmin, isManager]);

  const handleSaveAssignedInterns = async () => {
    if (!project) return;
    setAssigning(true);
    setAssignError("");
    try {
      const updated = await projectsApi.assignInterns(project.id, Array.from(selectedUserIds));
      setProject(updated);
      setShowAssignModal(false);
      fetchProjectData();
    } catch (err: any) {
      setAssignError(err.message || "Failed to update project team.");
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateProjectTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskInternId || !project) return;
    setCreatingTask(true);
    setTaskError("");
    try {
      await tasksApi.create({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        intern_id: taskInternId,
        project_id: project.id,
        due_date: taskDueDate || undefined,
        priority: taskPriority,
      });
      setShowAddTaskModal(false);
      setTaskTitle(""); setTaskDesc(""); setTaskInternId(""); setTaskDueDate(""); setTaskPriority("MEDIUM");
      fetchProjectData();
    } catch (err: any) {
      setTaskError(err.message || "Failed to create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleInternSelection = (uid: string) => {
    const next = new Set(selectedUserIds);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    setSelectedUserIds(next);
  };

  if (loading) return <AppShell><div className="loading-overlay"><div className="spinner" /></div></AppShell>;
  if (!project) return <AppShell><div style={{ padding: 32, color: "var(--color-danger)" }}>Project not found.</div></AppShell>;

  const completedCount = projectTasks.filter((t) => t.status === "COMPLETED").length;
  const percent = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    COMPLETED: { label: "Completed", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    ON_HOLD:   { label: "On Hold",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    PLANNING:  { label: "Planning",  color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    ACTIVE:    { label: "Active",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    setDeleteErr("");
    try {
      await projectsApi.delete(project.id);
      const basePath = isAdmin ? "/admin" : isManager ? "/manager" : "/intern";
      router.push(`${basePath}/projects`);
    } catch (err: any) {
      setDeleteErr(err.message || "Failed to delete project.");
      setDeleting(false);
    }
  };

  const projStatus = statusColors[project.status] || statusColors.ACTIVE;

  const internListForTask = project.interns.length > 0
    ? project.interns
    : allInterns.map((i) => ({ id: i.user_id, full_name: i.full_name, company_email: i.company_email, role: "intern" }));

  return (
    <AppShell>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-lg)", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", flexShrink: 0 }}>
            <FolderIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Project
            </div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{project.name}</h1>
            {project.department && (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                {project.department.name}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ background: projStatus.bg, color: projStatus.color, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {projStatus.label}
          </span>
          {(isAdmin || isManager) && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setShowDeleteModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete Project
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
            ← Back
          </button>
        </div>
      </div>

      {/* Overview: Scope + Progress */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <InfoIcon /> Project Details
          </h2>
          {project.description ? (
            <p style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 16 }}>
              {project.description}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-text-dim)", marginBottom: 16, fontStyle: "italic" }}>No description provided.</p>
          )}
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Status</div>
              <div className="detail-value" style={{ color: projStatus.color, fontWeight: 600 }}>{projStatus.label}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Department</div>
              <div className="detail-value">{project.department?.name || "Company-wide"}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Start Date</div>
              <div className="detail-value">{formatDate(project.start_date)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Target End Date</div>
              <div className="detail-value">{formatDate(project.target_end_date)}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <ChartIcon /> Task Completion
            </h2>
            <div style={{ fontSize: 40, fontWeight: 800, color: percent === 100 ? "#10b981" : "var(--color-primary)", marginBottom: 4, lineHeight: 1 }}>
              {percent}%
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
              {completedCount} of {projectTasks.length} tasks completed
            </div>
            <div style={{ height: 8, background: "var(--color-surface-2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${percent}%`, background: percent === 100 ? "#10b981" : "var(--color-primary)", borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Project Team */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <UsersIcon /> Project Team
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 4 }}>({project.interns.length} intern{project.interns.length !== 1 ? "s" : ""})</span>
          </h2>
          {(isAdmin || isManager) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAssignError(""); setShowAssignModal(true); }}>
              <EditIcon /> Manage Team
            </button>
          )}
        </div>
        {project.interns.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-dim)", fontStyle: "italic" }}>No interns assigned to this project yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {project.interns.map((intern) => (
              <div key={intern.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {intern.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {intern.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {intern.company_email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Tasks */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <TaskIcon /> Project Tasks
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 4 }}>({projectTasks.length})</span>
          </h2>
          {(isAdmin || isManager) && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setTaskError(""); setShowAddTaskModal(true); }}>
              <PlusIcon /> Add Task
            </button>
          )}
        </div>

        {projectTasks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-dim)", fontStyle: "italic" }}>No tasks created for this project yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--color-text)", fontSize: 13 }}>{t.title}</div>
                      {t.description && (
                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{t.intern_name || "—"}</td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td style={{ fontSize: 13 }}>{formatDate(t.due_date)}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Assign Team Members Modal ─────────────────────────────────────────── */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAssignModal(false); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
                  <UsersIcon />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Manage Team</h2>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                    Select interns for {project.name} {project.department?.name ? `(${project.department.name} Department)` : ""}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAssignModal(false)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>
                ×
              </button>
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {(() => {
                const targetDeptId = project.department?.id || project.department_id;
                const filteredInterns = targetDeptId
                  ? allInterns.filter((i) => (i.department?.id || i.department_id) === targetDeptId)
                  : allInterns;

                if (filteredInterns.length === 0) {
                  return (
                    <p style={{ fontSize: 13, color: "var(--color-text-dim)", textAlign: "center", padding: 20 }}>
                      No interns found in {project.department?.name || "this department"}.
                    </p>
                  );
                }

                return filteredInterns.map((i) => (
                  <label
                    key={i.user_id}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: selectedUserIds.has(i.user_id) ? "rgba(99,102,241,0.08)" : "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: `1px solid ${selectedUserIds.has(i.user_id) ? "rgba(99,102,241,0.4)" : "var(--color-border)"}`, cursor: "pointer", transition: "all 0.15s ease" }}
                  >
                    <input type="checkbox" checked={selectedUserIds.has(i.user_id)} onChange={() => toggleInternSelection(i.user_id)} style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--color-primary)" }} />
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {i.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{i.full_name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{i.company_email}</div>
                    </div>
                    {selectedUserIds.has(i.user_id) && <CheckIcon />}
                  </label>
                ));
              })()}
            </div>

            {assignError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "#ef4444", marginTop: 12 }}>
                {assignError}
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={assigning} onClick={handleSaveAssignedInterns}>
                {assigning ? "Saving…" : `Save Team (${selectedUserIds.size} selected)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Project Task Modal ────────────────────────────────────────────── */}
      {showAddTaskModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddTaskModal(false); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
                  <TaskIcon />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Task</h2>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>Create a task under {project.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddTaskModal(false)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateProjectTask}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label">Task Title <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <input type="text" required className="form-input" placeholder="e.g. Implement OAuth Flow" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="form-label">Assign To <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <select className="form-select" required value={taskInternId} onChange={(e) => setTaskInternId(e.target.value)}>
                    <option value="">Select intern…</option>
                    {internListForTask.map((i) => (
                      <option key={i.id} value={i.id}>{i.full_name} — {i.company_email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} placeholder="Acceptance criteria, requirements…" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} style={{ resize: "vertical", minHeight: 72 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-input" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH")}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
                {taskError && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
                    {taskError}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creatingTask}>
                  {creatingTask ? "Creating…" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Project Safeguard Modal ────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 className="modal-title" style={{ color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete Project
              </h2>
              <button type="button" onClick={() => setShowDeleteModal(false)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}>✕</button>
            </div>
            {deleteErr && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{deleteErr}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="alert alert-danger" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>Warning:</strong> You are about to permanently delete project <strong>"{project.name}"</strong>. This will unassign team members and remove project associations from tasks.
              </div>
              <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
                Are you sure you want to proceed with deleting this project?
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleting}
                onClick={handleDeleteProject}
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function FolderIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function InfoIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}
function ChartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function UsersIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
}
function TaskIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function EditIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
