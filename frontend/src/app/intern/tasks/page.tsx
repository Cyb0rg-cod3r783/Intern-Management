"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { tasksApi, Task, ApiError } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function InternTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
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
    tasksApi.list({ status: statusFilter || undefined })
      .then(setTasks)
      .catch((e) => { if (e?.status !== 401) console.error(e); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadTasks();
  }, [user, statusFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        evidence_link: evidenceLink.trim() || undefined,
      });

      // Reset form & close modal
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
          Add New Task

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

      {/* Create Task Modal / Form */}
      {showCreateModal && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--color-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Create New Task</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  Assigned by Manager/Admin
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
                {submitting ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        tasks.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks yet</h3>
            <p>Click "+ Add New Task" above to add your first task!</p>
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
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 8, maxWidth: 500 }}>{task.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
                      <StatusBadge status={task.priority} />
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
