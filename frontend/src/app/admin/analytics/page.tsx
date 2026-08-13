"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { adminApi, AnalyticsData, ApiError } from "@/lib/api";
import Link from "next/link";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.analytics()
      .then(setData)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppShell requiredRole="ADMIN"><div className="loading-overlay"><div className="spinner" /></div></AppShell>;
  if (error || !data) return <AppShell requiredRole="ADMIN"><div className="alert alert-danger">{error || "Failed to load analytics"}</div></AppShell>;

  const totalInterns = data.interns.total || 1;
  const activePct = Math.round((data.interns.active / totalInterns) * 100);
  const alumniPct = Math.round((data.interns.alumni / totalInterns) * 100);
  const inactivePct = Math.round((data.interns.inactive / totalInterns) * 100);

  const totalTasks = data.tasks.total || 1;
  const taskCompletedPct = Math.round((data.tasks.completed / totalTasks) * 100);
  const taskInProgressPct = Math.round((data.tasks.in_progress / totalTasks) * 100);
  const taskBlockedPct = Math.round((data.tasks.blocked / totalTasks) * 100);

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Insights</h1>
          <p className="page-subtitle">Visual break-down of intern lifecycles, task performance, and stipend metrics</p>
        </div>
      </div>

      {/* Top Stat Summary Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatTile title="Active Ratio" value={`${activePct}%`} sub={`${data.interns.active} of ${data.interns.total} interns`} color="green" />
        <StatTile title="Task Completion" value={`${data.tasks.completion_rate}%`} sub={`${data.tasks.completed} tasks completed`} color="blue" />
        <StatTile title="Overdue Rate" value={`${Math.round((data.tasks.overdue / totalTasks) * 100)}%`} sub={`${data.tasks.overdue} tasks overdue`} color="red" />
        <StatTile title="Monthly Stipend" value={`₹${data.financial.total_monthly_stipend.toLocaleString()}`} sub={`${data.financial.paid_interns} paid interns`} color="purple" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Intern Status Distribution */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>
            Intern Status Distribution
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ProgressRow label="Active Interns" count={data.interns.active} percentage={activePct} color="var(--color-success)" />
            <ProgressRow label="Alumni" count={data.interns.alumni} percentage={alumniPct} color="var(--color-info)" />
            <ProgressRow label="Inactive" count={data.interns.inactive} percentage={inactivePct} color="var(--color-text-dim)" />
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-text-muted)" }}>
            <span>Ending in 30 Days: <strong>{data.interns.ending_soon_30_days}</strong></span>
            <span>Paid vs Unpaid: <strong>{data.interns.paid} / {data.interns.unpaid}</strong></span>
          </div>
        </div>

        {/* Task Performance Breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>
            Task Performance Breakdown
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ProgressRow label="Completed" count={data.tasks.completed} percentage={taskCompletedPct} color="var(--color-success)" />
            <ProgressRow label="In Progress" count={data.tasks.in_progress} percentage={taskInProgressPct} color="var(--color-primary)" />
            <ProgressRow label="Blocked" count={data.tasks.blocked} percentage={taskBlockedPct} color="var(--color-warning)" />
            <ProgressRow label="Overdue" count={data.tasks.overdue} percentage={Math.round((data.tasks.overdue / totalTasks) * 100)} color="var(--color-danger)" />
          </div>
        </div>
      </div>

      {/* Department Breakdown Bar Visualization */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>
          Department Headcount Analysis
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.by_department.map((dept) => {
            const pct = Math.round((dept.count / totalInterns) * 100) || 0;
            return (
              <div key={dept.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{dept.name}</span>
                  <span style={{ color: "var(--color-text-muted)" }}>{dept.count} interns ({pct}%)</span>
                </div>
                <div style={{ height: 10, background: "var(--color-surface-2)", borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                      borderRadius: 99,
                      transition: "width 400ms ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({ title, value, sub, color }: { title: string; value: string; sub: string; color: string }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function ProgressRow({ label, count, percentage, color }: { label: string; count: number; percentage: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--color-text)" }}>{label}</span>
        <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>{count} ({percentage}%)</span>
      </div>
      <div style={{ height: 8, background: "var(--color-surface-2)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${percentage}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}
