"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { dailyLogsApi, tasksApi, Task, DailyLog } from "@/lib/api";
import { formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";

interface TaskAllocation {
  task_id: string;
  hours_spent: number;
  description: string;
  evidence_link: string;
  new_task_status: string;
}

export default function InternDailyLogsPage() {
  const { user } = useAuth();
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [logHistory, setLogHistory] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [totalHours, setTotalHours] = useState<number>(8.0);
  const [summaryNotes, setSummaryNotes] = useState<string>("");
  const [allocations, setAllocations] = useState<TaskAllocation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasks, history] = await Promise.all([
        tasksApi.list({ my_tasks_only: true }),
        dailyLogsApi.getMyLogs(30),
      ]);
      const activeTasks = tasks.filter(t => t.status !== "COMPLETED");
      setAssignedTasks(activeTasks);
      setLogHistory(history);

      // Pre-fill today's log if already submitted
      const todayStr = new Date().toISOString().split("T")[0];
      const todayLog = history.find(l => l.log_date === todayStr);
      if (todayLog) {
        setLogDate(todayLog.log_date);
        setSummaryNotes(todayLog.summary_notes || "");
        if (todayLog.entries.length > 0) {
          const validAllocations = todayLog.entries
            .filter(e => e.task_id && activeTasks.some(t => t.id === e.task_id))
            .map(e => ({
              task_id: e.task_id || "",
              hours_spent: e.hours_spent,
              description: e.description || "",
              evidence_link: e.evidence_link || "",
              new_task_status: "",
            }));
          setAllocations(validAllocations);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Auto-calculated total hours derived strictly from active selected task allocations
  const calculatedTotalHours = allocations
    .filter(a => assignedTasks.some(t => t.id === a.task_id))
    .reduce((sum, a) => sum + (Number(a.hours_spent) || 0), 0);

  const toggleTaskAllocation = (taskId: string) => {
    const existing = allocations.find(a => a.task_id === taskId);
    if (existing) {
      setAllocations(allocations.filter(a => a.task_id !== taskId));
    } else {
      setAllocations([...allocations, {
        task_id: taskId,
        hours_spent: 0,
        description: "",
        evidence_link: "",
        new_task_status: "",
      }]);
    }
  };

  const updateAllocation = (taskId: string, field: keyof TaskAllocation, val: any) => {
    setAllocations(allocations.map(a => a.task_id === taskId ? { ...a, [field]: val } : a));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);
    try {
      await dailyLogsApi.submit({
        log_date: logDate,
        total_hours: calculatedTotalHours,
        summary_notes: summaryNotes.trim() || undefined,
        entries: allocations.map(a => ({
          task_id: a.task_id || undefined,
          hours_spent: Number(a.hours_spent) || 0,
          description: a.description.trim() || undefined,
          evidence_link: a.evidence_link.trim() || undefined,
          new_task_status: a.new_task_status || undefined,
        })),
      });

      setFormMsg({ type: "success", text: "Daily work log submitted successfully!" });
      loadData();
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Failed to submit daily work log." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell requiredRole="INTERN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Work Logger</h1>
          <p className="page-subtitle">Track your daily hours, task accomplishments, and progress updates</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
          {/* Work Log Submission Form */}
          <div className="card" style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--color-border)" }}>
              <ClockIcon style={{ width: 22, height: 22, color: "var(--color-primary)" }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>Log Today's Work &amp; Activity</h2>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Date & Hours Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Log Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={logDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Total Hours Worked Today <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-primary)" }}>(Auto-calculated)</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{
                        background: "var(--color-surface-2)",
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        cursor: "not-allowed",
                      }}
                      value={`${calculatedTotalHours} hrs`}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Task Selection & Breakdown */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: "block" }}>
                  Select Tasks Worked On Today ({assignedTasks.length} Active Assigned Tasks)
                </label>

                {assignedTasks.length === 0 ? (
                  <div style={{ padding: "12px 14px", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--color-text-muted)" }}>
                    No active tasks currently assigned to you. You can still enter summary notes below!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {assignedTasks.map((t) => {
                      const isSelected = allocations.some(a => a.task_id === t.id);
                      const alloc = allocations.find(a => a.task_id === t.id);

                      return (
                        <div
                          key={t.id}
                          style={{
                            border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                            background: isSelected ? "rgba(59, 130, 246, 0.05)" : "var(--color-surface-2)",
                            borderRadius: "var(--radius-md)",
                            padding: "12px 14px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => toggleTaskAllocation(t.id)}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ width: 16, height: 16, cursor: "pointer" }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{t.title}</div>
                                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                  {t.project_name ? `Project: ${t.project_name}` : "Standalone Task"} • Priority: {t.priority}
                                </div>
                              </div>
                            </div>
                            <span className={`badge ${t.status === "IN_PROGRESS" ? "badge-active" : t.status === "BLOCKED" ? "badge-warning" : "badge-secondary"}`} style={{ fontSize: 10 }}>
                              {t.status}
                            </span>
                          </div>

                          {isSelected && alloc && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>Hours Spent</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    max="24"
                                    className="form-input"
                                    style={{ padding: "4px 8px", fontSize: 13 }}
                                    value={alloc.hours_spent}
                                    onChange={(e) => updateAllocation(t.id, "hours_spent", parseFloat(e.target.value) || 0)}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>Update Task Status (Optional)</label>
                                  <select
                                    className="form-select"
                                    style={{ padding: "4px 8px", fontSize: 13 }}
                                    value={alloc.new_task_status}
                                    onChange={(e) => updateAllocation(t.id, "new_task_status", e.target.value)}
                                  >
                                    <option value="">Keep current status ({t.status})</option>
                                    <option value="IN_PROGRESS">Mark In Progress</option>
                                    <option value="BLOCKED">Mark Blocked</option>
                                    <option value="COMPLETED">Mark Completed</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)" }}>Task Accomplishment Notes</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: "6px 10px", fontSize: 13 }}
                                  placeholder="Describe what you completed or tested on this task today…"
                                  value={alloc.description}
                                  onChange={(e) => updateAllocation(t.id, "description", e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* General Work Notes */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Overall Daily Summary Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: 70, resize: "vertical", fontSize: 13 }}
                  placeholder="Summary of overall accomplishments, blockers, or learnings today…"
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                />
              </div>

              {formMsg && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  fontWeight: 600,
                  background: formMsg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: formMsg.type === "success" ? "var(--color-success)" : "var(--color-danger)",
                  border: formMsg.type === "success" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                }}>
                  {formMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ padding: "10px 20px", fontSize: 14, fontWeight: 700, alignSelf: "flex-start" }}
              >
                {submitting ? "Submitting Log…" : "Submit Daily Work Log"}
              </button>
            </form>
          </div>

          {/* Submission History Feed */}
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--color-text)" }}>Log Submission History</h2>

            {logHistory.length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No past daily logs submitted yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {logHistory.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>{formatDate(l.log_date)}</span>
                      <span className="badge badge-success" style={{ fontSize: 11 }}>{l.total_hours} hrs</span>
                    </div>

                    {l.summary_notes && (
                      <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                        {l.summary_notes}
                      </p>
                    )}

                    {l.entries.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                        {l.entries.map((e) => (
                          <div key={e.id} style={{ fontSize: 11, color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between" }}>
                            <span>• {e.task_title || e.project_name || "Task"}</span>
                            <span style={{ fontWeight: 600 }}>{e.hours_spent}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ClockIcon({ style }: { style?: React.CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20, ...style }}><circle cx={12} cy={12} r={10}/><polyline points="12 6 12 12 16 14"/></svg>;
}
