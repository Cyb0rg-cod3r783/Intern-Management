"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { dailyLogsApi, ManagerDailyLogsResponse, DailyLog, internsApi, InternProfile } from "@/lib/api";
import { formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";

export default function ManagerDailyLogsPage() {
  const { user } = useAuth();
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedInternId, setSelectedInternId] = useState<string>("");
  const [teamProfiles, setTeamProfiles] = useState<InternProfile[]>([]);
  const [data, setData] = useState<ManagerDailyLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [inspectingLog, setInspectingLog] = useState<DailyLog | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Load team interns
  useEffect(() => {
    if (!user) return;
    internsApi.list({ manager_id: user.id })
      .then(setTeamProfiles)
      .catch(() => {});
  }, [user]);

  // Load logs for date
  const loadData = () => {
    setLoading(true);
    dailyLogsApi.getManagerLogs(targetDate)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [targetDate]);

  const setPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setTargetDate(d.toISOString().split("T")[0]);
  };

  const handleSendReminder = async (internId: string) => {
    setSendingReminder(internId);
    setMsg(null);
    try {
      const res = await dailyLogsApi.sendReminder(internId);
      setMsg(res.message);
      loadData();
    } catch {
      setMsg("Failed to send reminder.");
    } finally {
      setSendingReminder(null);
    }
  };

  const filteredLogs = data ? data.logs.filter(l => !selectedInternId || l.intern_id === selectedInternId) : [];
  const filteredSummary = data ? data.team_summary.filter(s => !selectedInternId || s.intern_id === selectedInternId) : [];

  return (
    <AppShell requiredRole="MANAGER">
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Daily Work Logs</h1>
          <p className="page-subtitle">Inspect task activity, hours allocation, and past daily log history across your squad</p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Intern Select */}
          <select
            className="form-select"
            style={{ padding: "6px 12px", fontSize: 13, width: 200 }}
            value={selectedInternId}
            onChange={(e) => setSelectedInternId(e.target.value)}
          >
            <option value="">All Department Interns</option>
            {teamProfiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.user?.full_name || p.new_tk_id || "Intern"}
              </option>
            ))}
          </select>

          {/* Quick Presets */}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${targetDate === new Date().toISOString().split("T")[0] ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setPresetDate(0)}
            >
              Today
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetDate(1)}>
              Yesterday
            </button>
          </div>

          <input
            type="date"
            className="form-input"
            style={{ padding: "5px 10px", fontSize: 13, width: 150 }}
            value={targetDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--color-primary)", marginBottom: 20 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : !data ? (
        <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--color-text-muted)" }}>
          Failed to load daily work log data for {formatDate(targetDate)}.
        </div>
      ) : (
        <>
          {/* Executive Analytics Ribbon */}
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase" }}>Logged on {formatDate(targetDate)}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-success)", marginTop: 4 }}>
                {data.logged_count} / {data.total_team_members} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Interns</span>
              </div>
            </div>

            <div style={{ background: data.missing_count > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--color-surface-2)", border: data.missing_count > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: data.missing_count > 0 ? "var(--color-danger)" : "var(--color-text-muted)", textTransform: "uppercase" }}>Missing Submissions</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: data.missing_count > 0 ? "var(--color-danger)" : "var(--color-text)", marginTop: 4 }}>
                {data.missing_count} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>Intern(s)</span>
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>Total Logged Hours</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary)", marginTop: 4 }}>
                {filteredLogs.reduce((s, l) => s + l.total_hours, 0)} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>hrs</span>
              </div>
            </div>
          </div>

          {/* Roster & Log Activity Feed */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 24 }}>
            {/* Left: Detailed Submission Feed for Date */}
            <div className="card">
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px 0", color: "var(--color-text)" }}>
                Task &amp; Accomplishment Logs ({formatDate(targetDate)})
              </h2>

              {filteredLogs.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No work logs submitted for {formatDate(targetDate)} matching current filter.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "16px 18px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>{log.intern_name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{log.intern_email}</div>
                        </div>
                        <span className="badge badge-success" style={{ fontWeight: 800, fontSize: 12, padding: "4px 10px" }}>
                          {log.total_hours} hrs logged
                        </span>
                      </div>

                      {log.summary_notes && (
                        <div style={{ background: "var(--color-surface-1)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>
                          <strong>Daily Summary:</strong> {log.summary_notes}
                        </div>
                      )}

                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                        Task Breakdown ({log.entries.length} Tasks)
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {log.entries.map((e) => (
                          <div key={e.id} style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, color: "var(--color-text)", marginBottom: 2 }}>
                              <span>• {e.task_title || "General Task Activity"}</span>
                              <span style={{ color: "var(--color-primary)" }}>{e.hours_spent}h</span>
                            </div>

                            {e.project_name && (
                              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
                                Project: {e.project_name}
                              </div>
                            )}

                            {e.description && (
                              <div style={{ fontSize: 12, color: "var(--color-text-dim)", lineHeight: 1.4 }}>
                                {e.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Team Submission Roster & Reminder Nudge */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--color-text)" }}>
                Team Submission Status
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredSummary.map((s) => (
                  <div
                    key={s.intern_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "12px 16px",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.intern_name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                        {s.new_tk_id || s.company_email}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      {s.has_logged_today ? (
                        <span className="badge badge-success" style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
                          ✓ {s.total_hours_today} hrs
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={sendingReminder === s.intern_id}
                          onClick={() => handleSendReminder(s.intern_id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid rgba(245, 158, 11, 0.4)",
                            background: "rgba(245, 158, 11, 0.12)",
                            color: "#d97706",
                            cursor: sendingReminder === s.intern_id ? "not-allowed" : "pointer",
                            transition: "all 0.15s ease",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <BellIcon />
                          {sendingReminder === s.intern_id ? "Sending…" : "Send Nudge"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function BellIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, ...style }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
