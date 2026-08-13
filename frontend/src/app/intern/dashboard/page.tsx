"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { internsApi, tasksApi, InternProfile, Task } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function InternDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<InternProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      internsApi.get(user.id),
      tasksApi.list(),
    ]).then(([p, t]) => { setProfile(p); setTasks(t); })
      .finally(() => setLoading(false));
  }, [user]);

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const overdueTasks = tasks.filter((t) => t.is_overdue).length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <AppShell requiredRole="INTERN">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Welcome, {user?.full_name}</p>
        </div>
        <Link href="/intern/tasks" className="btn btn-primary">View All Tasks</Link>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <>
          {/* Stats */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <StatCard label="Total Tasks" value={tasks.length} color="blue" />
            <StatCard label="Completed" value={completedTasks} color="green" />
            <StatCard label="In Progress" value={inProgressTasks} color="cyan" />
            <StatCard label="Overdue" value={overdueTasks} color="red" />
          </div>

          {/* Completion progress bar */}
          {tasks.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Overall Task Completion</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-success)" }}>{completionRate}%</span>
              </div>
              <div style={{ height: 8, background: "var(--color-surface-2)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${completionRate}%`,
                  background: "linear-gradient(90deg, var(--color-primary), var(--color-success))",
                  borderRadius: 99, transition: "width 500ms ease",
                }} />
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Profile summary */}
            {profile && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700 }}>My Profile</h2>
                  <Link href="/intern/profile" style={{ fontSize: 13, color: "var(--color-primary)" }}>View →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <InfoRow label="Department" value={profile.department?.name || "—"} />
                  <InfoRow label="Reporting Manager" value={profile.reporting_manager?.full_name || "—"} />
                  <InfoRow label="Joining Date" value={formatDate(profile.joining_date)} />
                  <InfoRow label="End Date" value={formatDate(profile.end_date)} />
                  <InfoRow label="Location" value={profile.location || "—"} />
                  <div style={{ marginTop: 4 }}><StatusBadge status={profile.status} /></div>
                </div>
              </div>
            )}

            {/* Recent tasks */}
            <div className="card">
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Recent Tasks</h2>
              {tasks.slice(0, 4).map((task) => (
                <Link key={task.id} href={`/intern/tasks/${task.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "10px 0", borderBottom: "1px solid var(--color-border)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text)" }}>{task.title}</div>
                      {task.due_date && (
                        <div style={{ fontSize: 12, color: task.is_overdue ? "var(--color-danger)" : "var(--color-text-dim)", marginTop: 2 }}>
                          Due: {formatDate(task.due_date)}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
                  </div>
                </Link>
              ))}
              {tasks.length === 0 && (
                <div style={{ color: "var(--color-text-dim)", textAlign: "center", padding: "20px 0" }}>No tasks yet</div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--color-text)" }}>{value}</span>
    </div>
  );
}
