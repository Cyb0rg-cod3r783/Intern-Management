"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { tasksApi, Task, internsApi, InternProfile } from "@/lib/api";
import { StatusBadge, formatDate, formatDateTime } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { safeHref } from "@/lib/utils";

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskForUpdates, setSelectedTaskForUpdates] = useState<Task | null>(null);

  // Form state
  const [selectedInternId, setSelectedInternId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [evidenceLink, setEvidenceLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadTasks = () => {
    setLoading(true);
    Promise.all([
      tasksApi.list({ status: statusFilter || undefined, priority: priorityFilter || undefined, overdue_only: overdueOnly || undefined }),
      internsApi.list(),
    ]).then(([tList, iList]) => {
      setTasks(tList);
      setInterns(iList);
      if (selectedTaskForUpdates) {
        const updated = tList.find((t) => t.id === selectedTaskForUpdates.id);
        if (updated) setSelectedTaskForUpdates(updated);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(loadTasks, [statusFilter, priorityFilter, overdueOnly]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
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
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
        evidence_link: evidenceLink.trim() || undefined,
      });

      // Reset form & close modal
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
                <label className="form-label">Assign To Intern *</label>
                <select
                  className="form-select"
                  value={selectedInternId}
                  onChange={(e) => setSelectedInternId(e.target.value)}
                  required
                >
                  <option value="">-- Select Intern --</option>
                  {interns.map((i) => (
                    <option key={i.user_id} value={i.user_id}>
                      {i.full_name} ({i.company_email})
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
      ) : tasks.length === 0 ? (
        <div className="empty-state"><h3>No tasks found</h3></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Intern</th>
                <th>Assigned By</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updates</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td>{task.intern_name || "—"}</td>
                  <td>{task.assigned_by_name || "—"}</td>
                  <td>
                    <DueDateCell task={task} onUpdate={loadTasks} />
                  </td>
                  <td><StatusBadge status={task.priority} /></td>
                  <td><StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} /></td>
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
