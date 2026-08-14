"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { tasksApi, Task, internsApi, InternProfile, projectsApi, Project } from "@/lib/api";
import { StatusBadge, formatDate, formatDateTime } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { safeHref } from "@/lib/utils";

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskForUpdates, setSelectedTaskForUpdates] = useState<Task | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  // Task approval workflow (intern self-assigned tasks)
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingTask, setRejectingTask] = useState<Task | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedInternId, setSelectedInternId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [evidenceLink, setEvidenceLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = () => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      tasksApi.list({ status: statusFilter || undefined, priority: priorityFilter || undefined, overdue_only: overdueOnly || undefined }),
      internsApi.list(),
      projectsApi.list(),
    ]).then(([tList, iList, pList]) => {
      setTasks(tList);
      setInterns(iList);
      setProjects(pList);
      if (selectedTaskForUpdates) {
        const updated = tList.find((t) => t.id === selectedTaskForUpdates.id);
        if (updated) setSelectedTaskForUpdates(updated);
      }
    }).catch((e: any) => {
      if (e?.status !== 401) console.error(e);
    }).finally(() => setLoading(false));
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  // Tasks are assigned to people working under a project — once a project is
  // picked, only interns in that project's department are assignable.
  // Company-wide projects (no department) don't restrict the list.
  const assignableInterns = selectedProject?.department
    ? interns.filter((i) => i.department?.id === selectedProject.department?.id)
    : interns;

  useEffect(() => {
    if (user) loadTasks();
  }, [user, statusFilter, priorityFilter, overdueOnly]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Please select a project — tasks are assigned under a project.");
      return;
    }
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!selectedInternId) {
      setError("Please select an intern to assign the task to.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await tasksApi.create({
        intern_id: selectedInternId,
        project_id: selectedProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
        evidence_link: evidenceLink.trim() || undefined,
      });

      // Reset form & close modal
      setSelectedProjectId("");
      setSelectedInternId("");
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");
      setEvidenceLink("");
      setShowCreateModal(false);

      loadTasks();
    } catch (err: any) {
      setError(err.message || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    // Reset intern selection — the previously chosen intern might not
    // belong to the newly selected project's department.
    setSelectedInternId("");
  };

  const handleApprove = async (task: Task) => {
    setApprovingId(task.id);
    try {
      await tasksApi.approve(task.id);
      loadTasks();
    } catch (err: any) {
      alert(err.message || "Failed to approve task.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingTask) return;
    setRejecting(true);
    try {
      await tasksApi.reject(rejectingTask.id, rejectReason.trim() || undefined);
      setRejectingTask(null);
      setRejectReason("");
      loadTasks();
    } catch (err: any) {
      alert(err.message || "Failed to reject task.");
    } finally {
      setRejecting(false);
    }
  };

  const pendingCount = tasks.filter((t) => t.approval_status === "PENDING").length;
  const displayedTasks = pendingOnly ? tasks.filter((t) => t.approval_status === "PENDING") : tasks;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks Management</h1>
          <p className="page-subtitle">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
          Assign New Task

        </button>
      </div>

      <div className="filter-bar">
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select className="form-select" style={{ width: 140 }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--color-text-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue Only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: pendingCount > 0 ? "#d97706" : "var(--color-text-muted)", cursor: "pointer", fontWeight: pendingCount > 0 ? 700 : 400 }}>
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Pending Approval Only {pendingCount > 0 && `(${pendingCount})`}
        </label>
      </div>

      {/* Create Task Modal / Card */}
      {showCreateModal && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--color-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Assign New Task</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Project *</label>
                <select
                  className="form-select"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  required
                >
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.department ? ` (${p.department.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title..."
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Assign To Intern *</label>
              <select
                className="form-select"
                value={selectedInternId}
                onChange={(e) => setSelectedInternId(e.target.value)}
                disabled={!selectedProjectId}
                required
              >
                <option value="">
                  {!selectedProjectId
                    ? "-- Select a project first --"
                    : assignableInterns.length === 0
                    ? "No interns in this project's department"
                    : "-- Select Intern --"}
                </option>
                {assignableInterns.map((i) => (
                  <option key={i.user_id} value={i.user_id}>
                    {i.full_name} ({i.company_email})
                  </option>
                ))}
              </select>
              {selectedProject?.department && (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Showing interns in {selectedProject.department.name} only, matching this project&apos;s department.
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task details and expectations..."
                rows={3}
              />
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reference / Document Link</label>
                <input
                  className="form-input"
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Assign Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : displayedTasks.length === 0 ? (
        <div className="empty-state"><h3>{pendingOnly ? "No tasks pending approval" : "No tasks found"}</h3></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Intern</th>
                <th>Assigned By</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Updates</th>
              </tr>
            </thead>
            <tbody>
              {displayedTasks.map((task) => (
                <tr key={task.id} style={task.approval_status === "PENDING" ? { background: "rgba(245, 158, 11, 0.05)" } : undefined}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{task.project_name || "—"}</td>
                  <td>{task.intern_name || "—"}</td>
                  <td>{task.assigned_by_name || "—"}</td>
                  <td>
                    <DueDateCell task={task} onUpdate={loadTasks} />
                  </td>
                  <td><StatusBadge status={task.priority} /></td>
                  <td><StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} /></td>
                  <td>
                    <ApprovalCell
                      task={task}
                      approving={approvingId === task.id}
                      onApprove={() => handleApprove(task)}
                      onReject={() => { setRejectReason(""); setRejectingTask(task); }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: (task.updates?.length || 0) > 0 ? "var(--color-primary)" : "var(--color-text-dim)",
                        borderColor: (task.updates?.length || 0) > 0 ? "var(--color-primary-glow)" : "var(--color-border)",
                      }}
                      onClick={() => setSelectedTaskForUpdates(task)}
                      title="Click to view progress update notes"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>
                      {task.updates?.length || 0} {task.updates?.length === 1 ? "update" : "updates"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Task Modal */}
      {rejectingTask && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setRejectingTask(null); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Reject Task</h2>
              <button type="button" onClick={() => setRejectingTask(null)} style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 18 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
              Rejecting <strong>{rejectingTask.title}</strong> self-assigned by <strong>{rejectingTask.intern_name}</strong>. They&apos;ll be notified.
            </p>
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Duplicate of an existing task, out of scope for this sprint…"
            />
            <div className="modal-footer" style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectingTask(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={rejecting} onClick={handleConfirmReject}>
                {rejecting ? "Rejecting…" : "Reject Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskUpdatesModal
        task={selectedTaskForUpdates}
        isOpen={Boolean(selectedTaskForUpdates)}
        onClose={() => setSelectedTaskForUpdates(null)}
        onUpdateAdded={loadTasks}
      />
    </AppShell>
  );
}

function TaskUpdatesModal({
  task,
  isOpen,
  onClose,
  onUpdateAdded,
}: {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateAdded: () => void;
}) {
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !task) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setAddingNote(true);
    setError("");
    try {
      await tasksApi.addProgressUpdate(task.id, note.trim());
      setNote("");
      onUpdateAdded();
    } catch (err: any) {
      setError(err.message || "Failed to add update note.");
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", borderRadius: "var(--radius-lg)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>{task.title}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Intern: <strong>{task.intern_name || "—"}</strong></span>
              <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
              <StatusBadge status={task.priority} />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Task Details */}
        {task.description && (
          <div style={{ background: "var(--color-surface-2)", padding: "12px 14px", borderRadius: "var(--radius-md)", fontSize: 14, lineHeight: 1.6, color: "var(--color-text)", marginBottom: 16 }}>
            {task.description}
          </div>
        )}

        {task.evidence_link && (
          <div style={{ marginBottom: 16, fontSize: 13 }}>
            <span style={{ color: "var(--color-text-muted)" }}>PR / Evidence Link: </span>
            <a href={safeHref(task.evidence_link)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}>
              {task.evidence_link} ↗
            </a>
          </div>
        )}

        {/* Timeline Updates List */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--color-text)" }}>
            Progress Updates ({task.updates?.length || 0})
          </h3>

          {(task.updates?.length || 0) === 0 ? (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <p style={{ color: "var(--color-text-dim)", fontSize: 13 }}>No updates recorded yet for this task.</p>
            </div>
          ) : (
            <div className="timeline" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {task.updates?.map((up, idx) => (
                <div key={up.id || idx} style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{up.author_name || "User"}</span>
                    <span style={{ color: "var(--color-text-dim)" }}>{formatDateTime(up.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {up.note}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Progress Note Form */}
        <form onSubmit={handleAddNote} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
          <label className="form-label" style={{ marginBottom: 6 }}>Add Update Note</label>
          <textarea
            className="form-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type progress update or manager feedback…"
            rows={3}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={addingNote || !note.trim()}>
              {addingNote ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Post Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApprovalCell({
  task,
  approving,
  onApprove,
  onReject,
}: {
  task: Task;
  approving: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (task.approval_status === "APPROVED") {
    // Nothing to review — keep the column quiet for the common case
    // (admin/manager-assigned tasks are always already approved).
    return <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>—</span>;
  }

  if (task.approval_status === "REJECTED") {
    return (
      <span
        className="badge"
        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 11, fontWeight: 700, padding: "3px 8px" }}
        title={task.rejection_reason || "Rejected"}
      >
        Rejected{task.rejection_reason ? " ⓘ" : ""}
      </span>
    );
  }

  // PENDING — a self-assigned task awaiting sign-off
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="badge" style={{ background: "rgba(245,158,11,0.14)", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "3px 8px" }}>
        Pending
      </span>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        style={{ padding: "3px 8px", fontSize: 11 }}
        disabled={approving}
        onClick={onApprove}
        title="Approve this self-assigned task"
      >
        {approving ? "…" : "Approve"}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ padding: "3px 8px", fontSize: 11, color: "var(--color-danger)" }}
        disabled={approving}
        onClick={onReject}
        title="Reject this self-assigned task"
      >
        Reject
      </button>
    </div>
  );
}

function DueDateCell({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [dateVal, setDateVal] = useState(task.due_date || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (val: string) => {
    setSaving(true);
    try {
      await tasksApi.update(task.id, { due_date: val || undefined });
      setEditing(false);
      onUpdate();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="date"
          className="form-input"
          style={{ padding: "3px 6px", fontSize: 12, width: 130 }}
          value={dateVal}
          onChange={(e) => setDateVal(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          style={{ padding: "3px 8px", fontSize: 11 }}
          onClick={() => handleSave(dateVal)}
          disabled={saving}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: "3px 6px", fontSize: 11 }}
          onClick={() => setEditing(false)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      style={{
        padding: "4px 8px",
        fontSize: 12,
        fontWeight: 500,
        color: task.is_overdue ? "var(--color-danger)" : task.due_date ? "var(--color-text)" : "var(--color-primary)",
        borderColor: task.due_date ? "var(--color-border)" : "var(--color-primary-glow)",
      }}
      onClick={() => setEditing(true)}
      title="Click to set/change due date"
    >
      {task.due_date ? formatDate(task.due_date) : "+ Set Due Date"}
    </button>
  );
}
