"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { tasksApi, projectsApi, Task, Project, ApiError } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function InternTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [evidenceLink, setEvidenceLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = () => {
    if (!user) return;
    setLoading(true);
    tasksApi.list({ status: statusFilter || undefined })
      .then(setTasks)
      .catch((e) => { if (e?.status !== 401) console.error(e); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadTasks();
  }, [user, statusFilter]);

  useEffect(() => {
    // projectsApi.list() is already scoped server-side to projects the
    // current intern is actually a team member of.
    if (user) projectsApi.list().then(setMyProjects).catch(() => {});
  }, [user]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Select a project — self-assigned tasks must be tied to one you're working on.");
      return;
    }
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await tasksApi.create({
        project_id: selectedProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        evidence_link: evidenceLink.trim() || undefined,
      });

      // Reset form & close modal
      setSelectedProjectId("");
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setEvidenceLink("");
      setShowCreateModal(false);

      // Reload tasks list
      loadTasks();
    } catch (err: any) {
      setError(err.message || "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell requiredRole="INTERN">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tasks</h1>
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
          Self-Assign Task

        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Self-Assign Task Modal / Form */}
      {showCreateModal && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--color-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Self-Assign a Task</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
            Pick one of your projects and claim a task from it — it'll be sent to your reporting manager for approval before it counts as assigned.
          </p>

          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

          {myProjects.length === 0 ? (
            <div className="alert" style={{ fontSize: 13, background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              You&apos;re not currently on any project team, so there&apos;s nothing to self-assign yet. Ask your manager to add you to a project first.
            </div>
          ) : (
          <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select
                className="form-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
              >
                <option value="">-- Select Project --</option>
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement user authentication middleware"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail what needs to be accomplished..."
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
                <div className="form-input" style={{ background: "var(--color-surface-1)", color: "var(--color-text-dim)", fontSize: 13, cursor: "not-allowed", display: "flex", alignItems: "center" }}>
                  Set by Manager/Admin only
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">PR / Evidence Link</label>
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
                {submitting ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Submit for Approval"}
              </button>
            </div>
          </form>
          )}
        </div>
      )}

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        tasks.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks yet</h3>
            <p>Click &quot;Self-Assign Task&quot; above to claim a task from one of your projects.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tasks.map((task) => (
              <Link key={task.id} href={`/intern/tasks/${task.id}`} style={{ textDecoration: "none" }}>
                <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, cursor: "pointer", transition: "border-color 200ms" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-active)"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{task.title}</span>
                      {task.approval_status === "PENDING" && (
                        <span className="badge" style={{ background: "rgba(245,158,11,0.14)", color: "#d97706", fontSize: 10, fontWeight: 700, padding: "2px 8px" }} title="Waiting on your manager's approval">
                          Pending Approval
                        </span>
                      )}
                      {task.approval_status === "REJECTED" && (
                        <span className="badge" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "2px 8px" }} title={task.rejection_reason || "Rejected by your manager"}>
                          Rejected
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 8, maxWidth: 500 }}>{task.description}</div>
                    )}
                    {task.approval_status === "REJECTED" && task.rejection_reason && (
                      <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8, maxWidth: 500 }}>
                        Reason: {task.rejection_reason}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
                      <StatusBadge status={task.priority} />
                      {task.project_name && (
                        <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>{task.project_name}</span>
                      )}
                      {task.due_date && (
                        <span style={{ fontSize: 12, color: task.is_overdue ? "var(--color-danger)" : "var(--color-text-dim)" }}>
                          Due: {formatDate(task.due_date)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                        {task.updates?.length || 0} update{task.updates?.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20, color: "var(--color-text-dim)", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </AppShell>
  );
}
