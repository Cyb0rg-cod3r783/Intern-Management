"use client";
import { useEffect, useState, Fragment } from "react";
import AppShell from "@/components/AppShell";
import { adminApi, projectsApi, AnalyticsData, ApiError, ProjectCostResponse, DepartmentCostResponse, FinancialOverviewResponse, EndingSoonResponse, EndingSoonCandidate, ProjectTaskHealthResponse, ProjectTaskHealthItem, ProjectDeepAnalyticsResponse, Project } from "@/lib/api";
import { formatDate, StatusBadge } from "@/components/ui-utils";
import Link from "next/link";

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "departments">("overview");

  useEffect(() => {
    adminApi.analytics()
      .then(setData)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Organization-wide overview — {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/interns/add" className="btn btn-primary">
            <PlusIcon /> Add Intern
          </Link>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              const res = await adminApi.exportInterns();
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url;
              a.download = "interns_export.csv"; a.click();
            }}
          >
            <DownloadIcon /> Export CSV
          </button>
        </div>
      </div>

      {/* Top Tab Navigation Header Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        borderBottom: "1px solid var(--color-border)",
        marginBottom: 24,
        paddingBottom: 0,
      }}>
        {[
          { id: "overview", label: "Executive Overview & Retention", icon: <UsersIcon /> },
          { id: "projects", label: "Projects & Execution Analytics", icon: <BarChartIcon /> },
          { id: "departments", label: "Department Financials", icon: <BuildingIcon /> },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 4px 14px 4px",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                position: "relative",
                transition: "color 0.2s ease",
              }}
            >
              <span style={{ display: "inline-flex", opacity: isActive ? 1 : 0.65 }}>{t.icon}</span>
              <span>{t.label}</span>

              {/* Active Tab Underline Indicator */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: 0,
                    right: 0,
                    height: 3,
                    borderRadius: "3px 3px 0 0",
                    background: "var(--color-primary)",
                    boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {loading && <div className="loading-overlay"><div className="spinner" /></div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {/* TAB 1: Executive Overview & Retention */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Intern Stats */}
              <div className="grid-3">
                <StatCard label="Total Interns" value={data.interns.total} color="blue" sub="All time" icon={<UsersIcon />} />
                <StatCard label="Active Interns" value={data.interns.active} color="green" sub="Currently interning" icon={<CheckIcon />} />
                <StatCard label="Ending Soon" value={data.interns.ending_soon_30_days} color="orange" sub="Within 30 days" icon={<ClockIcon />} />
              </div>

              {/* Financial Overview Widget */}
              <FinancialOverviewSection />

              {/* Upcoming Tenure Completions & Retention Center */}
              <EndingSoonAnalyticsSection />

              {/* Quick Links Navigation Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Manage Interns", href: "/admin/interns", icon: <UsersIcon />, desc: "View, edit, deactivate interns" },
                  { label: "Departments", href: "/admin/departments", icon: <BuildingIcon />, desc: "Manage department list" },
                  { label: "Audit Logs", href: "/admin/audit-logs", icon: <ShieldIcon />, desc: "Access and security logs" },
                  { label: "Analytics", href: "/admin/analytics", icon: <BarChartIcon />, desc: "Charts and trends" },
                  { label: "Handovers", href: "/admin/handovers", icon: <ArrowRightIcon />, desc: "Monitor handover status" },
                  { label: "User Management", href: "/admin/managers", icon: <UserCheckIcon />, desc: "Manage users and roles" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="card"
                    style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 14, padding: 16 }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "var(--radius-md)",
                      background: "var(--color-primary-glow)", color: "var(--color-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {link.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{link.label}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-dim)" }}>{link.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Projects & Execution Analytics */}
          {activeTab === "projects" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Project & Task Execution Health Widget */}
              <ProjectTaskExecutionHealthSection />

              {/* Executive Deep Project Intelligence & Lifecycle Hub */}
              <ExecutiveProjectIntelligenceSection />

              {/* Per-Project Financial & Cost Analytics */}
              <ProjectFinancialAnalyticsSection />
            </div>
          )}

          {/* TAB 3: Department Financial Breakdown */}
          {activeTab === "departments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Department-wise Financial & Stipend Breakdown Widget */}
              <DepartmentFinancialAnalyticsSection />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function ProjectTaskExecutionHealthSection() {
  const [filter, setFilter] = useState<"ALL" | "AT_RISK" | "COMPLETED">("ALL");
  const [healthData, setHealthData] = useState<ProjectTaskHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.projectTaskHealth()
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
    <div className="card" style={{ marginBottom: 24, border: "1px solid rgba(59, 130, 246, 0.3)" }}>
      {/* Header & Filter Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
              <BarChartIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Project &amp; Task Execution Health
            </h2>
            <span className="badge badge-admin" style={{ fontSize: 11 }}>Admin Only</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Real-time project completion progress, task delivery velocity, and critical bottleneck tracking
          </p>
        </div>        {/* Filter Pills */}
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
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load project execution health.</p>
      ) : (
        <>
          {/* Executive KPI Summary Ribbon & Progress Bar */}
          <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>Overall Delivery Progress:</span>
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
              No projects found matching the selected health filter.
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
                              <Link href={`/admin/projects`} style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">
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

function EndingSoonAnalyticsSection() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<EndingSoonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEndingSoon = () => {
    setLoading(true);
    adminApi.endingSoon(days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEndingSoon();
  }, [days]);

  return (
    <div className="card" style={{ marginBottom: 24, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
              <ClockIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Upcoming Tenure Completions &amp; Retention Center
            </h2>
            <span className="badge badge-admin" style={{ fontSize: 11 }}>Admin Only</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Active intern tenure expirations requiring executive retention, promotion, or offboarding decisions
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
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load upcoming tenure completions.</p>
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
              No intern tenures are expiring within the next {data.days_window} days.
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
                    <th style={{ textAlign: "right" }}>Executive Actions</th>
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
                            <Link href={`/admin/interns/${c.id}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">
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
                            <Link href={`/admin/interns/${c.id}`} className="btn btn-secondary" style={{ padding: "3px 8px", fontSize: 11 }}>
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

function FinancialOverviewSection() {
  const [timeframe, setTimeframe] = useState<"monthly" | "quarterly" | "half_yearly" | "annually" | "custom">("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [finData, setFinData] = useState<FinancialOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = () => {
    setLoading(true);
    adminApi.financialOverview({
      timeframe,
      start_date: timeframe === "custom" && startDate ? startDate : undefined,
      end_date: timeframe === "custom" && endDate ? endDate : undefined,
    })
      .then(setFinData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, [timeframe, startDate, endDate]);

  return (
    <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.25)" }}>
      {/* Header & Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldIcon />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            Financial Overview
          </h2>
          <span className="badge badge-admin" style={{ fontSize: 11 }}>Admin Only</span>
        </div>

        {/* Timeframe Selector Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {(["monthly", "quarterly", "half_yearly", "annually", "custom"] as const).map((t) => {
            const labels: Record<string, string> = {
              monthly: "Monthly",
              quarterly: "Quarterly",
              half_yearly: "Half-Yearly",
              annually: "Yearly",
              custom: "Custom",
            };
            const active = timeframe === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 16,
                  fontSize: 11,
                  fontWeight: 600,
                  border: active ? "1px solid var(--color-danger)" : "1px solid var(--color-border)",
                  background: active ? "rgba(239, 68, 68, 0.15)" : "var(--color-surface-2)",
                  color: active ? "var(--color-danger)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{labels[t]}</span>
                {t === "custom" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {timeframe === "custom" && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, background: "var(--color-surface-2)", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>Date Range:</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>From:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 130, padding: "3px 6px", fontSize: 11 }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>To:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 130, padding: "3px 6px", fontSize: 11 }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {finData?.period_label && (
            <div style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 600, marginLeft: "auto" }}>
              {finData.period_label}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, textAlign: "center" }}><div className="spinner" /></div>
      ) : !finData ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>Failed to load financial overview.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Card 1: Total Stipend Commitment */}
          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Total Stipend Commitment
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.5px" }}>
              ₹{finData.calculated_stipend_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)" }} />
              <span>{finData.period_label}</span>
            </div>
          </div>

          {/* Card 2: Paid Active Interns */}
          <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Paid Active Interns
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-success)", letterSpacing: "-0.5px" }}>
              {finData.paid_interns} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>({finData.total_active_interns > 0 ? Math.round((finData.paid_interns / finData.total_active_interns) * 100) : 0}%)</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Out of {finData.total_active_interns} active interns
            </div>
          </div>

          {/* Card 3: Unpaid Active Interns */}
          <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Unpaid Active Interns
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.5px" }}>
              {finData.unpaid_interns} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>({finData.total_active_interns > 0 ? Math.round((finData.unpaid_interns / finData.total_active_interns) * 100) : 0}%)</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Eligible for paid promotion
            </div>
          </div>

          {/* Card 4: Monthly Run Rate */}
          <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Monthly Run Rate
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)", letterSpacing: "-0.5px" }}>
              ₹{finData.monthly_stipend_total.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Avg ₹{finData.average_stipend_per_paid_intern.toLocaleString()}/paid intern
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectFinancialAnalyticsSection() {
  const [timeframe, setTimeframe] = useState<"monthly" | "quarterly" | "half_yearly" | "annually" | "custom">("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [costData, setCostData] = useState<ProjectCostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const fetchCosts = () => {
    setLoading(true);
    adminApi.projectCosts({
      timeframe,
      start_date: timeframe === "custom" && startDate ? startDate : undefined,
      end_date: timeframe === "custom" && endDate ? endDate : undefined,
    })
      .then(setCostData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCosts();
  }, [timeframe, startDate, endDate]);

  const toggleExpand = (pId: string) => {
    setExpandedProjectId((prev) => (prev === pId ? null : pId));
  };

  return (
    <div className="card" style={{ marginBottom: 24, border: "1px solid rgba(59, 130, 246, 0.25)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
              <BarChartIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Per-Project Financial Analytics &amp; Cost Calculations
            </h2>
            <span className="badge badge-admin" style={{ fontSize: 11 }}>Admin Only</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Stipend commitments calculated across assigned active intern teams
          </p>
        </div>

        {/* Timeframe Filter Selector */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {(["monthly", "quarterly", "half_yearly", "annually", "custom"] as const).map((t) => {
            const labels: Record<string, string> = {
              monthly: "Monthly",
              quarterly: "Quarterly",
              half_yearly: "Half-Yearly",
              annually: "Annually",
              custom: "Custom Range",
            };
            const active = timeframe === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: active ? "var(--color-primary-glow)" : "var(--color-surface-2)",
                  color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{labels[t]}</span>
                {t === "custom" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {timeframe === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface-2)", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Select Custom Period:</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>From:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 140, padding: "4px 8px", fontSize: 12 }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>To:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 140, padding: "4px 8px", fontSize: 12 }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {costData?.period_label && (
            <div style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 600, marginLeft: "auto" }}>
              {costData.period_label}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 30, textAlign: "center" }}><div className="spinner" /></div>
      ) : !costData ? (
        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: 20 }}>Failed to load financial calculations.</p>
      ) : (
        <>
          {/* Executive KPI Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Total {costData.period_label} Cost
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.total_timeframe_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                Across {costData.total_projects} projects
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Monthly Run Rate
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.total_monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                Active monthly stipend sum
              </div>
            </div>

            <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Average Cost per Project
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.average_project_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                For {costData.period_label} period
              </div>
            </div>
          </div>

          {/* Project Cost Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Project Name</th>
                  <th style={{ whiteSpace: "nowrap" }}>Department</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>Team</th>
                  <th style={{ whiteSpace: "nowrap" }}>Monthly</th>
                  <th style={{ whiteSpace: "nowrap" }}>Period Cost</th>
                  <th style={{ whiteSpace: "nowrap" }}>Share</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {costData.projects.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 20 }}>
                      No projects found.
                    </td>
                  </tr>
                ) : (
                  costData.projects.map((p) => {
                    const sharePct = costData.total_timeframe_cost > 0
                      ? Math.round((p.calculated_cost / costData.total_timeframe_cost) * 100)
                      : 0;
                    const isExpanded = expandedProjectId === p.id;

                    return (
                      <Fragment key={p.id}>
                        <tr>
                          <td style={{ fontWeight: 600, color: "var(--color-text)", maxWdith: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>
                            <Link href={`/admin/projects/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                              {p.name}
                            </Link>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="badge badge-intern" style={{ fontSize: 11, padding: "2px 8px" }}>{p.department_name}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <StatusBadge status={p.status} />
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ display: "flex" }}>
                                {p.assigned_interns.slice(0, 3).map((i, idx) => (
                                  <div
                                    key={i.id}
                                    title={`${i.full_name} (₹${i.stipend_amount.toLocaleString()}/mo)`}
                                    style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                                      color: "#fff", fontSize: 9, fontWeight: 700,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      border: "2px solid var(--color-surface)", marginLeft: idx > 0 ? -6 : 0,
                                    }}
                                  >
                                    {i.full_name[0]?.toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{p.interns_count} intern{p.interns_count !== 1 ? "s" : ""}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                            ₹{p.monthly_cost.toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--color-success)", fontSize: 13, whiteSpace: "nowrap" }}>
                            ₹{p.calculated_cost.toLocaleString()}
                          </td>
                          <td style={{ width: 85, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ flex: 1, minWidth: 35, height: 5, background: "var(--color-surface-2)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${sharePct}%`, height: "100%", background: "linear-gradient(90deg, var(--color-primary), var(--color-success))", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>{sharePct}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: "3px 8px", whiteSpace: "nowrap" }}
                              onClick={() => toggleExpand(p.id)}
                            >
                              {isExpanded ? "Hide ▲" : "View Team ▼"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Team Breakdown Row */}
                        {isExpanded && (
                          <tr style={{ background: "rgba(17, 24, 39, 0.5)" }}>
                            <td colSpan={8} style={{ padding: "12px 20px" }}>
                              <div style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: 14, border: "1px solid var(--color-border)" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                  <UsersIcon /> Assigned Team Stipend Breakdown for "{p.name}"
                                </div>
                                {p.assigned_interns.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: 0 }}>No active interns assigned to this project.</p>
                                ) : (
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                                    {p.assigned_interns.map((intern) => {
                                      const internTimeframeCost = round(intern.stipend_amount * (costData?.multiplier || 1), 2);
                                      return (
                                        <div key={intern.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{intern.full_name}</div>
                                            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{intern.company_email}</div>
                                          </div>
                                          <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-success)" }}>
                                              ₹{intern.stipend_amount.toLocaleString()}<span style={{ fontSize: 10, color: "var(--color-text-dim)" }}>/mo</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                              {costData?.period_label}: <strong>₹{internTimeframeCost.toLocaleString()}</strong>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DepartmentFinancialAnalyticsSection() {
  const [timeframe, setTimeframe] = useState<"monthly" | "quarterly" | "half_yearly" | "annually" | "custom">("monthly");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [costData, setCostData] = useState<DepartmentCostResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);

  const fetchCosts = () => {
    setLoading(true);
    adminApi.departmentCosts({
      timeframe,
      start_date: timeframe === "custom" && startDate ? startDate : undefined,
      end_date: timeframe === "custom" && endDate ? endDate : undefined,
    })
      .then(setCostData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCosts();
  }, [timeframe, startDate, endDate]);

  const toggleExpand = (deptId: string) => {
    setExpandedDeptId((prev) => (prev === deptId ? null : deptId));
  };

  return (
    <div className="card" style={{ marginBottom: 24, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-success)" }}>
              <BuildingIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Department-wise Financial &amp; Stipend Breakdown
            </h2>
            <span className="badge badge-admin" style={{ fontSize: 11 }}>Admin Only</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Active intern headcount &amp; financial commitment per department across selected timeframes
          </p>
        </div>

        {/* Timeframe Filter Selector */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {(["monthly", "quarterly", "half_yearly", "annually", "custom"] as const).map((t) => {
            const labels: Record<string, string> = {
              monthly: "Monthly",
              quarterly: "Quarterly",
              half_yearly: "Half-Yearly",
              annually: "Annually",
              custom: "Custom Range",
            };
            const active = timeframe === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? "1px solid var(--color-success)" : "1px solid var(--color-border)",
                  background: active ? "rgba(16, 185, 129, 0.15)" : "var(--color-surface-2)",
                  color: active ? "var(--color-success)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{labels[t]}</span>
                {t === "custom" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {timeframe === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface-2)", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>Select Custom Period:</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>From:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 140, padding: "4px 8px", fontSize: 12 }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)" }}>To:</label>
            <input
              type="date"
              className="form-input"
              style={{ width: 140, padding: "4px 8px", fontSize: 12 }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {costData?.period_label && (
            <div style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 600, marginLeft: "auto" }}>
              {costData.period_label}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 30, textAlign: "center" }}><div className="spinner" /></div>
      ) : !costData ? (
        <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: 20 }}>Failed to load department financial calculations.</p>
      ) : (
        <>
          {/* Executive KPI Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-success)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Total Department {costData.period_label} Cost
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.total_timeframe_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                Across {costData.total_departments} departments ({costData.total_active_interns} active interns)
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Monthly Department Run Rate
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.total_monthly_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                Active monthly department stipend sum
              </div>
            </div>

            <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "var(--radius-md)", padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Average Cost per Department
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
                ₹{costData.average_department_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                For {costData.period_label} period
              </div>
            </div>
          </div>

          {/* Department Cost Table */}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Department</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>Headcount</th>
                  <th style={{ whiteSpace: "nowrap" }}>Monthly Stipend</th>
                  <th style={{ whiteSpace: "nowrap" }}>Period Cost ({costData.period_label})</th>
                  <th style={{ whiteSpace: "nowrap" }}>Budget Share</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {costData.departments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--color-text-muted)", padding: 20 }}>
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  costData.departments.map((d) => {
                    const sharePct = costData.total_timeframe_cost > 0
                      ? Math.round((d.calculated_cost / costData.total_timeframe_cost) * 100)
                      : 0;
                    const isExpanded = expandedDeptId === d.id;

                    return (
                      <Fragment key={d.id}>
                        <tr>
                          <td style={{ fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap" }}>
                            <div>
                              <div>{d.name}</div>
                              {d.description && <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 400 }}>{d.description}</div>}
                            </div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className={`badge ${d.is_active ? "badge-active" : "badge-inactive"}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                              {d.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ display: "flex" }}>
                                {d.assigned_interns.slice(0, 3).map((i, idx) => (
                                  <div
                                    key={i.id}
                                    title={`${i.full_name} (${i.new_tk_id || 'TK'})`}
                                    style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: "linear-gradient(135deg, var(--color-success), var(--color-primary))",
                                      color: "#fff", fontSize: 9, fontWeight: 700,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      border: "2px solid var(--color-surface)", marginLeft: idx > 0 ? -6 : 0,
                                    }}
                                  >
                                    {i.full_name[0]?.toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)" }}>
                                {d.interns_count} intern{d.interns_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                            ₹{d.monthly_cost.toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--color-success)", fontSize: 13, whiteSpace: "nowrap" }}>
                            ₹{d.calculated_cost.toLocaleString()}
                          </td>
                          <td style={{ width: 85, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ flex: 1, minWidth: 35, height: 5, background: "var(--color-surface-2)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${sharePct}%`, height: "100%", background: "linear-gradient(90deg, var(--color-success), var(--color-primary))", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>{sharePct}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: "3px 8px", whiteSpace: "nowrap" }}
                              onClick={() => toggleExpand(d.id)}
                            >
                              {isExpanded ? "Hide ▲" : "View Interns ▼"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Department Intern Breakdown Row */}
                        {isExpanded && (
                          <tr style={{ background: "rgba(17, 24, 39, 0.5)" }}>
                            <td colSpan={7} style={{ padding: "12px 20px" }}>
                              <div style={{ background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: 14, border: "1px solid var(--color-border)" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                  <UsersIcon /> Active Interns in "{d.name}" Department ({d.interns_count})
                                </div>
                                {d.assigned_interns.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "var(--color-text-dim)", margin: 0 }}>No active interns in this department.</p>
                                ) : (
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                                    {d.assigned_interns.map((intern) => {
                                      const internTimeframeCost = round(intern.stipend_amount * (costData?.multiplier || 1), 2);
                                      return (
                                        <div key={intern.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "var(--color-primary-glow)", color: "var(--color-primary)" }}>{intern.new_tk_id || 'TK'}</span>
                                              <span style={{ fontSize: 13, fontWeight: 600 }}>{intern.full_name}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace", marginTop: 2 }}>{intern.company_email}</div>
                                          </div>
                                          <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-success)" }}>
                                              ₹{intern.stipend_amount.toLocaleString()}<span style={{ fontSize: 10, color: "var(--color-text-dim)" }}>/mo</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                              {costData?.period_label}: <strong>₹{internTimeframeCost.toLocaleString()}</strong>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function round(val: number, decimals: number): number {
  return Number(Math.round(Number(val + "e" + decimals)) + "e-" + decimals);
}

function StatCard({ label, value, color, sub, icon }: { label: string; value: number | string; color: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="stat-label">{label}</div>
        <div style={{ color: "var(--color-text-dim)", opacity: 0.6 }}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: "var(--color-success)", blue: "var(--color-primary)",
    orange: "var(--color-warning)", red: "var(--color-danger)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ? colorMap[color] : "var(--color-text)" }}>{value}</div>
    </div>
  );
}

function ExecutiveProjectIntelligenceSection() {
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [analytics, setAnalytics] = useState<ProjectDeepAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPhase, setUpdatingPhase] = useState(false);

  useEffect(() => {
    projectsApi.list().then((list) => {
      setProjectsList(list);
      if (list.length > 0) setSelectedProjectId(list[0].id);
    }).catch(() => {});
  }, []);

  const loadDeepAnalytics = (pId: string) => {
    if (!pId) return;
    setLoading(true);
    adminApi.projectDeepAnalytics(pId)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedProjectId) loadDeepAnalytics(selectedProjectId);
  }, [selectedProjectId]);

  const handlePhaseChange = async (newPhase: string) => {
    if (!selectedProjectId) return;
    setUpdatingPhase(true);
    try {
      await projectsApi.updatePhase(selectedProjectId, newPhase);
      loadDeepAnalytics(selectedProjectId);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingPhase(false);
    }
  };

  return (
    <div className="card" style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}>
      {/* Header & Selector */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
              <BarChartIcon />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Executive Project Intelligence &amp; Deep Analytics
            </h2>
            <span className="badge badge-primary" style={{ fontSize: 11 }}>CEO Dashboard</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0 40px" }}>
            Comprehensive lifecycle phase tracking, total man-hours, financial burn, and per-contributor effort allocations
          </p>
        </div>

        {/* Project Dropdown Selector */}
        <div>
          <select
            className="form-select"
            style={{ padding: "6px 14px", fontSize: 13, minWidth: 220, fontWeight: 600 }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.department?.name || "Dept"})</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center" }}><div className="spinner" /></div>
      ) : !analytics ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Select a project to inspect executive intelligence.</p>
      ) : (
        <>
          {/* Project Phase & Health Summary Header */}
          <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>{analytics.name}</h3>
                  <span className={`badge ${analytics.health_status === "ON_TRACK" ? "badge-success" : analytics.health_status === "AT_RISK" ? "badge-danger" : "badge-secondary"}`} style={{ fontSize: 11, fontWeight: 700 }}>
                    {analytics.health_status === "ON_TRACK" ? "✓ ON TRACK" : analytics.health_status === "AT_RISK" ? "⚠️ AT RISK" : "✓ COMPLETED"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Department: <strong>{analytics.department_name}</strong> • Timeline: {formatDate(analytics.start_date)} to {formatDate(analytics.target_end_date)}
                </div>
              </div>

              {/* Lifecycle Phase Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>Project Phase:</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["PLANNING", "DEVELOPMENT", "TESTING", "COMPLETED"].map((ph) => {
                    const isCurrent = analytics.phase === ph;
                    return (
                      <button
                        key={ph}
                        type="button"
                        disabled={updatingPhase}
                        onClick={() => handlePhaseChange(ph)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 11,
                          fontWeight: 700,
                          border: isCurrent ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          background: isCurrent ? "var(--color-primary)" : "var(--color-surface-1)",
                          color: isCurrent ? "#fff" : "var(--color-text-muted)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {ph}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {analytics.description && (
              <p style={{ fontSize: 13, color: "var(--color-text-dim)", margin: 0, lineHeight: 1.4 }}>
                {analytics.description}
              </p>
            )}
          </div>

          {/* 4 Pillars Metric Ribbons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>Total Man-Hours Logged</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)", marginTop: 4 }}>
                {analytics.total_man_hours_logged} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>hrs lifetime</span>
              </div>
            </div>

            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase" }}>Monthly Burn Cost</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-success)", marginTop: 4 }}>
                ₹{analytics.monthly_burn_cost.toLocaleString("en-IN")} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>/ mo</span>
              </div>
            </div>

            <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase" }}>Team Size &amp; Contributors</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>
                {analytics.total_team_members} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>Active Interns</span>
              </div>
            </div>

            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>Task Velocity &amp; Pulse</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
                {analytics.completed_tasks} / {analytics.total_tasks} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>({analytics.completion_rate}%)</span>
              </div>
            </div>
          </div>

          {/* Contributor Labor Allocation Breakdown Table */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "var(--color-text)" }}>
              Team Contributor Labor &amp; Man-Hours Allocation ({analytics.contributors.length} Team Members)
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Contributor Name &amp; ID</th>
                    <th style={{ textAlign: "left" }}>Tasks (Done / Total)</th>
                    <th style={{ textAlign: "left" }}>Hours Logged</th>
                    <th style={{ textAlign: "left" }}>Effort Share %</th>
                    <th style={{ textAlign: "right" }}>Monthly Stipend Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.contributors.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--color-text-muted)" }}>No interns assigned to this project yet.</td></tr>
                  ) : (
                    analytics.contributors.map((c) => (
                      <tr key={c.intern_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{c.intern_name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{c.new_tk_id || c.company_email}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700 }}>{c.tasks_completed}</span> / {c.tasks_assigned}
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                          {c.hours_logged} hrs
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "var(--color-surface-3)", borderRadius: 3, overflow: "hidden", minWidth: 60 }}>
                              <div style={{ width: `${c.effort_share_pct}%`, height: "100%", background: "var(--color-primary)", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{c.effort_share_pct}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-success)" }}>
                          ₹{c.monthly_stipend.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><polyline points="20 6 9 17 4 12"/></svg>; }
function StarIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><circle cx={12} cy={12} r={10}/><polyline points="12 6 12 12 16 14"/></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function BuildingIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><rect x={2} y={7} width={20} height={14} rx={1}/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>; }
function BarChartIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><line x1={18} y1={20} x2={18} y2={10}/><line x1={12} y1={20} x2={12} y2={4}/><line x1={6} y1={20} x2={6} y2={14}/></svg>; }
function ArrowRightIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><line x1={5} y1={12} x2={19} y2={12}/><polyline points="12 5 19 12 12 19"/></svg>; }
function UserCheckIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={8.5} cy={7} r={4}/><polyline points="17 11 19 13 23 9"/></svg>; }
function AlertCircleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function CheckCircleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>; }
function AlertTriangleIcon({ style }: { style?: React.CSSProperties }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, ...style }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
