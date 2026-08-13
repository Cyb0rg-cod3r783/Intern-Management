"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { internsApi, tasksApi, managerApi, dailyLogsApi, InternProfile, Task, ProjectTaskHealthResponse, EndingSoonResponse, ManagerDailyLogsResponse } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

import PendingApprovalsBucket from "@/components/PendingApprovalsBucket";
import { safeHref } from "@/lib/utils";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [deptInterns, setDeptInterns] = useState<InternProfile[]>([]);
  const [myInterns, setMyInterns] = useState<InternProfile[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [blockedTasks, setBlockedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = () => {
    if (!user) return;
    Promise.all([
      internsApi.list(user.department_id ? { department_id: user.department_id } : {}),
      internsApi.list({ manager_id: user.id }),
      tasksApi.list({ overdue_only: true }),
      tasksApi.list({ status: "BLOCKED" }),
    ]).then(([dept, mine, overdue, blocked]) => {
      setDeptInterns(dept);
      setMyInterns(mine);
      setOverdueTasks(overdue);
      setBlockedTasks(blocked);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  return (
    <AppShell requiredRole="MANAGER">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manager Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.full_name}</p>
        </div>
        <Link href="/manager/handovers" className="btn btn-secondary">Manage Handovers</Link>
      </div>

      <PendingApprovalsBucket onApprovalHandled={refreshData} />

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <StatCard label="Department Interns" value={deptInterns.length} color="blue" />
            <StatCard label="My Interns" value={myInterns.length} color="green" />
            <StatCard label="Overdue Tasks" value={overdueTasks.length} color="red" />
            <StatCard label="Blocked Tasks" value={blockedTasks.length} color="orange" />
          </div>

          {/* 1. Department Project & Task Execution Health (HERO WIDGET) */}
          <div style={{ marginBottom: 24 }}>
            <ManagerProjectTaskExecutionHealthSection />
          </div>

          {/* 2. Department Daily Activity & Work Log Tracker (NEW HERO WIDGET) */}
          <div style={{ marginBottom: 24 }}>
            <ManagerDailyWorkLogsWidget />
          </div>

          {/* 3. Department Tenure Completions & Retention Center (HERO WIDGET) */}
          <div style={{ marginBottom: 24 }}>
            <ManagerEndingSoonAnalyticsSection />
          </div>

          {/* 3. Bottom Row: My Team Roster & Operational Task Monitor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* My Interns */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UsersIcon />
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>My Assigned Team</h2>
                </div>
                <Link href="/manager/my-interns" style={{ fontSize: 13, color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>View all →</Link>
              </div>
              {myInterns.slice(0, 5).map((intern) => (
                <Link key={intern.id} href={`/manager/interns/${intern.user_id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: "var(--radius-md)",
                    marginBottom: 6, transition: "background 200ms",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-2)",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-3)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                    }}>
                      {intern.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>{intern.full_name}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{intern.department?.name || "Unassigned"}</div>
                    </div>
                    <StatusBadge status={intern.status} />
                  </div>
                </Link>
              ))}
              {myInterns.length === 0 && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No interns currently assigned to your direct manager profile.</div>
              )}
            </div>

            {/* Task & Bottleneck Monitor */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <AlertCircleIcon style={{ width: 18, height: 18, color: "var(--color-primary)" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>Operational Task &amp; Bottleneck Monitor</h2>
              </div>
              
              {overdueTasks.length > 0 || blockedTasks.length > 0 ? (
                <>
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.id} style={{
                      background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)",
                      borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 8,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertCircleIcon style={{ width: 14, height: 14 }} /> {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                        Assignee: {task.intern_name} • Due: {formatDate(task.due_date)}
                      </div>
                    </div>
                  ))}
                  {blockedTasks.slice(0, 3).map((task) => (
                    <div key={task.id} style={{
                      background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 8,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangleIcon style={{ width: 14, height: 14 }} /> {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                        Assignee: {task.intern_name} • Blocked Dependency
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ display: "inline-flex", width: 40, height: 40, borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", alignItems: "center", justifyContent: "center", color: "var(--color-success)", marginBottom: 8 }}>
                    <CheckCircleIcon style={{ width: 22, height: 22 }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-success)" }}>
                    Zero Task Bottlenecks Identified
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 14px" }}>
                    All squad deliverables are operating at 100% velocity with zero overdue or blocked tasks.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
                    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Overdue Tasks</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-success)" }}>0</div>
                    </div>
                    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Blocked Tasks</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-success)" }}>0</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function ManagerProjectTaskExecutionHealthSection() {
  const [filter, setFilter] = useState<"ALL" | "AT_RISK" | "COMPLETED">("ALL");
  const [healthData, setHealthData] = useState<ProjectTaskHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    managerApi.projectTaskHealth()
      .then(setHealthData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = (healthData?.projects || []).filter((p) => {
    if (filter === "AT_RISK") return p.health_status === "AT_RISK";
    if (filter === "COMPLETED") return p.health_status === "COMPLETED";
    return true;
  });

  return (
    <div className="card" style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}>
      {/* Header & Filter Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
              <BarChartIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Department Project &amp; Task Execution Health
            </h2>
            <span className="badge badge-active" style={{ fontSize: 11 }}>My Department</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Real-time project velocity, squad task execution, and bottleneck tracking for your assigned department
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { id: "ALL", label: "All Projects" },
            { id: "AT_RISK", label: "At Risk", icon: <AlertCircleIcon style={{ width: 12, height: 12 }} /> },
            { id: "COMPLETED", label: "Completed", icon: <CheckCircleIcon style={{ width: 12, height: 12 }} /> },
          ].map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as any)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "5px 12px",
                  borderRadius: 18,
                  fontSize: 11,
                  fontWeight: 600,
                  border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: active ? "var(--color-primary-glow)" : "var(--color-surface-2)",
                  color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : !healthData ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load department project execution health.</p>
      ) : (
        <>
          {/* Executive KPI Summary Ribbon & Progress Bar */}
          <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>Overall Department Delivery Progress:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>{healthData.overall_completion_rate}%</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: "var(--color-success)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircleIcon style={{ width: 13, height: 13 }} /> {healthData.projects_on_track} On Track
                </span>
                <span style={{ color: "var(--color-danger)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertCircleIcon style={{ width: 13, height: 13 }} /> {healthData.projects_at_risk} At Risk
                </span>
                <span style={{ color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircleIcon style={{ width: 13, height: 13 }} /> {healthData.projects_completed} Completed
                </span>
                <span style={{ color: "var(--color-danger)", borderLeft: "1px solid var(--color-border)", paddingLeft: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangleIcon style={{ width: 13, height: 13 }} /> {healthData.overdue_tasks} Overdue • {healthData.blocked_tasks} Blocked
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div style={{ width: "100%", height: 8, background: "var(--color-surface-3)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${healthData.overall_completion_rate}%`,
                  height: "100%",
                  background: healthData.projects_at_risk > 0 ? "linear-gradient(90deg, #10b981 0%, #f59e0b 70%, #ef4444 100%)" : "linear-gradient(90deg, #3b82f6 0%, #10b981 100%)",
                  borderRadius: 4,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Project List Cards / Table */}
          {filteredProjects.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: 13 }}>
              No projects found for your department matching the selected filter.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Project &amp; Squad</th>
                    <th style={{ textAlign: "left" }}>Delivery Progress</th>
                    <th style={{ textAlign: "left" }}>Task Breakdown</th>
                    <th style={{ textAlign: "left" }}>Bottlenecks</th>
                    <th style={{ textAlign: "right" }}>Health Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const isAtRisk = p.health_status === "AT_RISK";
                    const isCompleted = p.health_status === "COMPLETED";

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            {p.id === "general" ? (
                              <span>{p.name}</span>
                            ) : (
                              <Link href={`/manager/projects`} style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">
                                {p.name}
                              </Link>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            Dept: {p.department_name} {p.team_count > 0 ? `• Team: ${p.team_count} Intern(s)` : ""}
                          </div>
                        </td>

                        <td style={{ minWidth: 160 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                            <span>{p.completed_tasks} / {p.total_tasks} Tasks</span>
                            <span style={{ color: isAtRisk ? "var(--color-danger)" : isCompleted ? "var(--color-success)" : "var(--color-primary)" }}>
                              {p.completion_rate}%
                            </span>
                          </div>
                          <div style={{ width: "100%", height: 6, background: "var(--color-surface-3)", borderRadius: 3, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${p.completion_rate}%`,
                                height: "100%",
                                background: isAtRisk ? "#ef4444" : isCompleted ? "#10b981" : "#3b82f6",
                                borderRadius: 3,
                              }}
                            />
                          </div>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="badge badge-success" style={{ fontSize: 10 }}>✓ {p.completed_tasks} Done</span>
                            <span className="badge badge-active" style={{ fontSize: 10 }}>{p.in_progress_tasks} Active</span>
                          </div>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          {p.overdue_tasks === 0 && p.blocked_tasks === 0 ? (
                            <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 600 }}>Zero Bottlenecks</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {p.overdue_tasks > 0 && (
                                <span className="badge badge-danger" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <AlertCircleIcon style={{ width: 10, height: 10 }} /> {p.overdue_tasks} Overdue
                                </span>
                              )}
                              {p.blocked_tasks > 0 && (
                                <span className="badge badge-warning" style={{ fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <AlertTriangleIcon style={{ width: 10, height: 10 }} /> {p.blocked_tasks} Blocked
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: isAtRisk ? "rgba(239, 68, 68, 0.15)" : isCompleted ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                              color: isAtRisk ? "var(--color-danger)" : isCompleted ? "var(--color-success)" : "var(--color-primary)",
                              border: isAtRisk ? "1px solid rgba(239, 68, 68, 0.4)" : isCompleted ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
                            }}
                          >
                            {isAtRisk ? (
                              <>
                                <AlertCircleIcon style={{ width: 12, height: 12 }} />
                                <span>AT RISK</span>
                              </>
                            ) : isCompleted ? (
                              <>
                                <CheckCircleIcon style={{ width: 12, height: 12 }} />
                                <span>COMPLETED</span>
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon style={{ width: 12, height: 12 }} />
                                <span>ON TRACK</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ManagerEndingSoonAnalyticsSection() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<EndingSoonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEndingSoon = () => {
    setLoading(true);
    managerApi.endingSoon(days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEndingSoon();
  }, [days]);

  return (
    <div className="card" style={{ border: "1px solid rgba(245, 158, 11, 0.3)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <ClockIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Department Tenure Completions &amp; Retention Center
            </h2>
            <span className="badge badge-active" style={{ fontSize: 11 }}>My Department</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Intern tenure expirations requiring department retention, evaluation, or handover planning
          </p>
        </div>

        {/* Timeframe Selector Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {[
            { id: 7, label: "7 Days (Urgent)" },
            { id: 15, label: "15 Days" },
            { id: 30, label: "30 Days" },
            { id: 60, label: "60 Days" },
          ].map((w) => {
            const active = days === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setDays(w.id)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 18,
                  fontSize: 11,
                  fontWeight: 600,
                  border: active ? "1px solid #f59e0b" : "1px solid var(--color-border)",
                  background: active ? "rgba(245, 158, 11, 0.15)" : "var(--color-surface-2)",
                  color: active ? "#f59e0b" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : !data ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load department tenure completions.</p>
      ) : (
        <>
          {/* Executive KPI Summary Ribbon */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-danger)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Critical (≤7 Days)
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-danger)", marginTop: 2 }}>
                {data.critical_count_7_days} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Candidate(s)</span>
              </div>
            </div>

            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Total Ending ({data.days_window} Days)
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", marginTop: 2 }}>
                {data.total_ending} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Candidate(s)</span>
              </div>
            </div>

            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ending Stipend Commitment
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", marginTop: 2 }}>
                ₹{data.ending_stipend_total.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>/mo ({data.paid_ending_count} Paid)</span>
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Unpaid Retention Potential
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)", marginTop: 2 }}>
                {data.unpaid_ending_count} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Eligible Candidate(s)</span>
              </div>
            </div>
          </div>

          {/* Candidate Table / Cards */}
          {data.candidates.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: 13 }}>
              No department intern tenures are expiring within the next {data.days_window} days.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Candidate &amp; ID</th>
                    <th style={{ textAlign: "left" }}>Department &amp; Manager</th>
                    <th style={{ textAlign: "left" }}>Placement Tier</th>
                    <th style={{ textAlign: "left" }}>End Date</th>
                    <th style={{ textAlign: "left" }}>Days Remaining</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.candidates.map((c) => {
                    const isCritical = c.urgency_level === "CRITICAL";
                    const isWarning = c.urgency_level === "WARNING";
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            <Link href={`/manager/interns/${c.user_id}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">
                              {c.full_name}
                            </Link>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            {c.new_tk_id || c.old_tk_id || "TK Intern"} {c.company_email ? `• ${c.company_email}` : ""}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, color: "var(--color-text)" }}>{c.department_name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Mgr: {c.reporting_manager_name}</div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className="badge badge-active" style={{ textTransform: "capitalize", fontSize: 11 }}>
                              {c.category}
                            </span>
                            <span className={`badge ${c.is_paid ? "badge-success" : "badge-warning"}`} style={{ fontSize: 10 }}>
                              {c.is_paid ? `Paid (₹${c.stipend_amount.toLocaleString()})` : "Unpaid"}
                            </span>
                          </div>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          {c.end_date ? formatDate(c.end_date) : "—"}
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: isCritical ? "rgba(239, 68, 68, 0.15)" : isWarning ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                              color: isCritical ? "var(--color-danger)" : isWarning ? "#f59e0b" : "var(--color-primary)",
                              border: isCritical ? "1px solid rgba(239, 68, 68, 0.4)" : isWarning ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
                            }}
                          >
                            {isCritical ? (
                              <AlertCircleIcon style={{ width: 12, height: 12 }} />
                            ) : (
                              <ClockIcon />
                            )}
                            <span>{c.days_remaining === 0 ? "Ends Today" : c.days_remaining === 1 ? "Ends Tomorrow" : `${c.days_remaining} Days Left`}</span>
                          </span>
                        </td>

                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <Link href={`/manager/interns/${c.user_id}`} className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 11 }}>
                              View Profile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ManagerDailyWorkLogsWidget() {
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<ManagerDailyLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Modal States
  const [inspectingLog, setInspectingLog] = useState<DailyLog | null>(null);
  const [historyIntern, setHistoryIntern] = useState<{ id: string; name: string } | null>(null);
  const [historyLogs, setHistoryLogs] = useState<DailyLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchLogs = (dStr: string) => {
    setLoading(true);
    dailyLogsApi.getManagerLogs(dStr)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(targetDate);
  }, [targetDate]);

  const handleSendReminder = async (internId: string) => {
    setSendingReminder(internId);
    setMsg(null);
    try {
      const res = await dailyLogsApi.sendReminder(internId);
      setMsg(res.message);
      fetchLogs(targetDate);
    } catch (err: any) {
      setMsg("Failed to send reminder.");
    } finally {
      setSendingReminder(null);
    }
  };

  const openHistoryModal = async (internId: string, internName: string) => {
    setHistoryIntern({ id: internId, name: internName });
    setLoadingHistory(true);
    try {
      const logs = await dailyLogsApi.getInternLogs(internId, 60);
      setHistoryLogs(logs);
    } catch (err: any) {
      if (err?.status !== 401) console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Preset Date Helper
  const setPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setTargetDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="card" style={{ border: "1px solid rgba(16, 185, 129, 0.3)" }}>
      {/* Header with Date Filter Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-success)" }}>
              <ClockIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Department Daily Activity &amp; Work Log Tracker
            </h2>
            <span className="badge badge-active" style={{ fontSize: 11 }}>My Department</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Real-time daily timesheets, task hour allocations, and missing submission alerts
          </p>
        </div>

        {/* Date Selector & Quick Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${targetDate === new Date().toISOString().split("T")[0] ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setPresetDate(0)}
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setPresetDate(1)}
            >
              Yesterday
            </button>
          </div>

          <input
            type="date"
            className="form-input"
            style={{ padding: "4px 10px", fontSize: 12, width: 140 }}
            value={targetDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "8px 12px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--color-primary)", marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : !data ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load department daily logs.</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase" }}>Logged on {formatDate(targetDate)}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-success)", marginTop: 2 }}>
                {data.logged_count} / {data.total_team_members} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Interns</span>
              </div>
            </div>

            <div style={{ background: data.missing_count > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--color-surface-2)", border: data.missing_count > 0 ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: data.missing_count > 0 ? "var(--color-danger)" : "var(--color-text-muted)", textTransform: "uppercase" }}>Missing Logs</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: data.missing_count > 0 ? "var(--color-danger)" : "var(--color-text)", marginTop: 2 }}>
                {data.missing_count} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Intern(s)</span>
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>Total Hours Logged</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)", marginTop: 2 }}>
                {data.logs.reduce((sum, l) => sum + l.total_hours, 0)} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>hrs</span>
              </div>
            </div>
          </div>

          {/* Team Log Roster Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Intern Name &amp; ID</th>
                  <th style={{ textAlign: "left" }}>Submission Status ({formatDate(targetDate)})</th>
                  <th style={{ textAlign: "left" }}>Hours Logged</th>
                  <th style={{ textAlign: "right" }}>Actions &amp; History</th>
                </tr>
              </thead>
              <tbody>
                {data.team_summary.map((s) => {
                  const activeLog = data.logs.find(l => l.intern_id === s.intern_id);

                  return (
                    <tr key={s.intern_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{s.intern_name}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{s.new_tk_id || s.company_email}</div>
                      </td>

                      <td>
                        {s.has_logged_today ? (
                          <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <CheckCircleIcon style={{ width: 12, height: 12 }} /> Logged ({formatDate(targetDate)})
                          </span>
                        ) : (
                          <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <AlertCircleIcon style={{ width: 12, height: 12 }} /> Missing Log ({formatDate(targetDate)})
                          </span>
                        )}
                      </td>

                      <td style={{ fontWeight: 700, fontSize: 13, color: s.has_logged_today ? "var(--color-text)" : "var(--color-text-muted)" }}>
                        {s.has_logged_today ? `${s.total_hours_today} hrs` : "0.0 hrs"}
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                          {s.has_logged_today && activeLog ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 11, padding: "3px 10px" }}
                              onClick={() => setInspectingLog(activeLog)}
                            >
                              View Activity Details
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={sendingReminder === s.intern_id}
                              onClick={() => handleSendReminder(s.intern_id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid rgba(245, 158, 11, 0.4)",
                                background: "rgba(245, 158, 11, 0.12)",
                                color: "#d97706",
                                cursor: sendingReminder === s.intern_id ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <BellIcon />
                              {sendingReminder === s.intern_id ? "Sending…" : "Send Nudge"}
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: "3px 10px" }}
                            onClick={() => openHistoryModal(s.intern_id, s.intern_name)}
                          >
                            Full History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Activity Breakdown Modal */}
      {inspectingLog && (
        <div className="modal-backdrop" onClick={() => setInspectingLog(null)}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Activity Log: {inspectingLog.intern_name}</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Submitted for {formatDate(inspectingLog.log_date)} • Total: <strong>{inspectingLog.total_hours} Hours</strong>
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectingLog(null)}>✕</button>
            </div>

            {inspectingLog.summary_notes && (
              <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Overall Daily Summary</div>
                <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>{inspectingLog.summary_notes}</div>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--color-text)" }}>Task &amp; Accomplishment Breakdown ({inspectingLog.entries.length} Tasks)</div>

            {inspectingLog.entries.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No individual task allocations recorded.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
                {inspectingLog.entries.map((e) => (
                  <div key={e.id} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{e.task_title || "General Task Activity"}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{e.project_name ? `Project: ${e.project_name}` : "Standalone Task"}</div>
                      </div>
                      <span className="badge badge-primary" style={{ fontWeight: 700, fontSize: 11 }}>{e.hours_spent} hrs</span>
                    </div>

                    {e.description && (
                      <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: "6px 0 0 0", lineHeight: 1.4 }}>
                        {e.description}
                      </p>
                    )}

                    {e.evidence_link && (
                      <div style={{ marginTop: 6, fontSize: 11 }}>
                        <a href={safeHref(e.evidence_link)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>
                          Proof of Work / Link →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setInspectingLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Intern Full History Modal */}
      {historyIntern && (
        <div className="modal-backdrop" onClick={() => setHistoryIntern(null)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Full Work Log History: {historyIntern.name}</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Complete historical daily timesheet entries
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHistoryIntern(null)}>✕</button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: 30, textAlign: "center" }}><div className="spinner" /></div>
            ) : historyLogs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                No past work logs found for this intern.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 440, overflowY: "auto" }}>
                {historyLogs.map((l) => (
                  <div key={l.id} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>{formatDate(l.log_date)}</span>
                      <span className="badge badge-success" style={{ fontWeight: 700, fontSize: 11 }}>{l.total_hours} hrs logged</span>
                    </div>

                    {l.summary_notes && (
                      <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                        {l.summary_notes}
                      </p>
                    )}

                    {l.entries.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                        {l.entries.map((e) => (
                          <div key={e.id} style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--color-text)" }}>
                              <span>• {e.task_title || e.project_name || "Task Activity"}</span>
                              <span>{e.hours_spent}h</span>
                            </div>
                            {e.description && <div style={{ paddingLeft: 10, color: "var(--color-text-dim)" }}>{e.description}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setHistoryIntern(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

// Icons
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>; }
function BarChartIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><line x1={18} y1={20} x2={18} y2={10}/><line x1={12} y1={20} x2={12} y2={4}/><line x1={6} y1={20} x2={6} y2={14}/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><circle cx={12} cy={12} r={10}/><polyline points="12 6 12 12 16 14"/></svg>; }
function AlertCircleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function CheckCircleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>; }
function AlertTriangleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function BellIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, ...style }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>; }
