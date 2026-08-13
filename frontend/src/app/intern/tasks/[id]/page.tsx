"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { tasksApi, Task, TaskUpdate } from "@/lib/api";
import { StatusBadge, formatDate, formatDateTime } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import { safeHref } from "@/lib/utils";

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = () => {
    tasksApi.get(taskId)
      .then(setTask)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [taskId]);

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await tasksApi.addProgressUpdate(taskId, note.trim());
      setNote("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) return <AppShell><div className="loading-overlay"><div className="spinner" /></div></AppShell>;
  if (error || !task) return <AppShell><div className="alert alert-danger">{error || "Task not found"}</div></AppShell>;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">{task.title}</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
            <StatusBadge status={task.priority} />
            {task.due_date && (
              <span style={{ fontSize: 13, color: task.is_overdue ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                Due: {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Left: Progress timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Task details */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Task Details</h2>
            {task.description && (
              <p style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.7, marginBottom: 16 }}>{task.description}</p>
            )}
            <div className="detail-grid">
              <div className="detail-item"><div className="detail-label">Assigned to</div><div className="detail-value">{task.intern_name || "—"}</div></div>
              <div className="detail-item"><div className="detail-label">Assigned by</div><div className="detail-value">{task.assigned_by_name || "—"}</div></div>
              <div className="detail-item"><div className="detail-label">Assigned Date</div><div className="detail-value">{formatDate(task.assigned_date)}</div></div>
              <div className="detail-item"><div className="detail-label">Completed Date</div><div className="detail-value">{formatDate(task.completed_date)}</div></div>
              {task.evidence_link && (
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="detail-label">Evidence / PR Link</div>
                  <a href={safeHref(task.evidence_link)} target="_blank" rel="noopener noreferrer" className="detail-value" style={{ color: "var(--color-primary)" }}>
                    {task.evidence_link} ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Progress updates timeline */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Progress Timeline ({task.updates?.length || 0})</h2>
            {(task.updates?.length || 0) === 0 ? (
              <div style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "20px 0" }}>No updates yet. Add the first one below.</div>
            ) : (
              <div className="timeline">
                {task.updates?.map((update, idx) => (
                  <div key={update.id} className="timeline-item">
                    <div className="timeline-dot">{idx + 1}</div>
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <span className="timeline-author">{update.author_name}</span>
                        <span className="timeline-date">{formatDateTime(update.created_at)}</span>
                      </div>
                      <div className="timeline-note">{update.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add update */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--color-border)" }}>
              <label className="form-label" style={{ marginBottom: 8, display: "block" }}>Add Progress Update</label>
              <textarea
                className="form-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you work on? Any blockers? What's next?"
                rows={3}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 10 }}
                onClick={handleAddNote}
                disabled={addingNote || !note.trim()}
              >
                {addingNote ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Add Update"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick status update */}
        <div className="card" style={{ height: "fit-content" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Quick Update</h2>
          <QuickStatusUpdate task={task} onUpdate={load} />
        </div>
      </div>
    </AppShell>
  );
}

function QuickStatusUpdate({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const [status, setStatus] = useState(task.status);
  const [evidenceLink, setEvidenceLink] = useState(task.evidence_link || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await tasksApi.update(task.id, { status, evidence_link: evidenceLink || undefined });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Evidence / PR Link</label>
        <input className="form-input" value={evidenceLink} onChange={(e) => setEvidenceLink(e.target.value)} placeholder="https://github.com/…" />
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
        {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Save Status"}
      </button>
    </div>
  );
}
