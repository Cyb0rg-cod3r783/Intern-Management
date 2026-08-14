"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { internsApi, departmentsApi, adminApi, InternProfile, Department, ApiError } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function InternProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isManager } = useAuth();
  const internId = params.id as string;
  const [intern, setIntern] = useState<InternProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"profile" | "tasks" | "history">("profile");

  // Modal Visibility States
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showStipendModal, setShowStipendModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  const fetchProfile = () => {
    internsApi.get(internId)
      .then(setIntern)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
  }, [internId]);

  if (loading) return <AppShell><div className="loading-overlay"><div className="spinner" /></div></AppShell>;
  if (error || !intern) return <AppShell><div className="alert alert-danger">{error || "Intern not found"}</div></AppShell>;

  const basePath = isAdmin ? "/admin" : "/manager";

  return (
    <AppShell>
      <div className="page-header" style={{ flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff",
          }}>
            {intern.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="page-title">{intern.full_name}</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-muted)" }}>{intern.company_email}</span>
              <StatusBadge status={intern.status} />
              {intern.category && <span className="badge badge-manager" style={{ textTransform: "uppercase" }}>{intern.category}</span>}
              {intern.new_tk_id && <span className="badge badge-intern">{intern.new_tk_id}</span>}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
          {isAdmin && (intern.category || "intern").toLowerCase() !== "full_time" && (
            <button className="btn btn-primary" onClick={() => setShowPromoteModal(true)} style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
                <path d="M20 21H4" />
              </svg>
              Promote Candidate
            </button>
          )}

          {(isAdmin || isManager) && (
            <button className="btn btn-secondary" onClick={() => setShowExtendModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Extend Internship
            </button>
          )}

          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowStipendModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Revise Stipend
            </button>
          )}

          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              Transfer Dept & Manager
            </button>
          )}

          {(isAdmin || isManager) && (
            <Link href={`${basePath}/interns/${internId}/edit`} className="btn btn-secondary">Edit Profile</Link>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>Profile</button>
        <button className={`tab-btn ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>Tasks</button>
        <button className={`tab-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History & Timeline
        </button>
      </div>

      {tab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Organizational Info */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--color-text)" }}>Organizational Details</h2>
            <div className="detail-grid">
              <DetailRow label="Department" value={intern.department?.name || "—"} />
              <DetailRow label="Reporting Manager" value={intern.reporting_manager?.full_name || "—"} />
              <DetailRow label="Category" value={intern.category ? intern.category.toUpperCase() : "—"} />
              <DetailRow label="Internship Type" value={intern.internship_type ? intern.internship_type.toUpperCase() : "—"} />
              <DetailRow label="Location" value={intern.location || "—"} />
              <DetailRow label="Duration" value={intern.duration || "—"} />
              <DetailRow label="TK ID" value={intern.new_tk_id || "—"} />
              <DetailRow label="Joining Date" value={formatDate(intern.joining_date)} />
              <DetailRow label="End Date" value={formatDate(intern.end_date)} />
              <DetailRow label="Status" value={<StatusBadge status={intern.status} />} />
            </div>
            {intern.remarks && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
                <div className="detail-label" style={{ marginBottom: 6 }}>Remarks</div>
                <div style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.6 }}>{intern.remarks}</div>
              </div>
            )}
          </div>

          {/* Admin-only sensitive section */}
          {isAdmin && (intern.personal_email || intern.personal_phone || (intern.internship_type !== "unpaid" && intern.stipend_amount !== undefined)) && (
            <div className="sensitive-section">
              <div className="sensitive-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Admin-Only Sensitive Information
                <span className="badge badge-admin" style={{ marginLeft: "auto" }}>Admin Only</span>
              </div>
              <div className="detail-grid">
                <DetailRow label="Personal Email" value={intern.personal_email || "—"} />
                <DetailRow label="Personal Phone Number" value={intern.personal_phone || "—"} />
                {intern.internship_type !== "unpaid" && (
                  <DetailRow label="Stipend Amount" value={intern.stipend_amount !== undefined && intern.stipend_amount !== null ? `₹${Number(intern.stipend_amount).toLocaleString()}` : "—"} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <TasksTab internId={intern.user_id} />
      )}

      {tab === "history" && (
        <HistoryTab internId={internId} isAdmin={isAdmin} />
      )}

      {/* QUICK ACTION MODALS */}
      {showExtendModal && (
        <ExtendInternshipModal
          intern={intern}
          onClose={() => setShowExtendModal(false)}
          onSuccess={() => {
            setShowExtendModal(false);
            fetchProfile();
          }}
        />
      )}

      {showStipendModal && (
        <ReviseStipendModal
          intern={intern}
          onClose={() => setShowStipendModal(false)}
          onSuccess={() => {
            setShowStipendModal(false);
            fetchProfile();
          }}
        />
      )}

      {showTransferModal && (
        <TransferDepartmentModal
          intern={intern}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
            fetchProfile();
          }}
        />
      )}

      {showPromoteModal && (
        <PromoteCandidateModal
          intern={intern}
          onClose={() => setShowPromoteModal(false)}
          onSuccess={() => {
            setShowPromoteModal(false);
            fetchProfile();
          }}
        />
      )}
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

function TasksTab({ internId }: { internId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/api").then(({ tasksApi }) => {
      tasksApi.list({ intern_id: internId })
        .then(setTasks)
        .finally(() => setLoading(false));
    });
  }, [internId]);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Tasks</h2>
      {tasks.length === 0 ? (
        <div className="empty-state"><h3>No tasks assigned</h3></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tasks.map((task) => (
            <div key={task.id} style={{
              background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)", padding: "14px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{task.title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge status={task.is_overdue ? "OVERDUE" : task.status} />
                  <StatusBadge status={task.priority} />
                  {task.due_date && (
                    <span style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                      Due: {formatDate(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ internId, isAdmin }: { internId: string; isAdmin: boolean }) {
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useEffect(() => {
    internsApi.getHistory(internId)
      .then(setHistoryData)
      .catch((e: any) => setError(e.message || "Failed to load history logs."))
      .finally(() => setLoading(false));
  }, [internId]);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (error || !historyData) return <div className="alert alert-danger">{error || "History data unavailable"}</div>;

  const { summary, projects_history, tasks_summary, logs } = historyData;

  const filteredLogs = logs.filter((log: any) => {
    if (categoryFilter === "ALL") return true;
    if (categoryFilter === "PROMOTIONS") return log.event_type === "PROMOTION";
    if (categoryFilter === "EXTENSIONS") return log.event_type === "INTERNSHIP_EXTENSION";
    if (categoryFilter === "STIPEND") return log.event_type === "STIPEND_REVISION";
    if (categoryFilter === "TRANSFERS") return log.event_type === "DEPARTMENT_TRANSFER" || log.event_type === "MANAGER_CHANGE";
    if (categoryFilter === "PROJECTS") return log.event_type === "PROJECT_ASSIGNED" || log.event_type === "PROJECT_REMOVED";
    if (categoryFilter === "STATUS") return log.event_type === "STATUS_CHANGE" || log.event_type === "ONBOARDING";
    return true;
  });

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "PROMOTION":
        return <span className="badge" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)", fontWeight: 700 }}>Promoted</span>;
      case "INTERNSHIP_EXTENSION":
        return <span className="badge badge-manager" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" }}>Extension</span>;
      case "STIPEND_REVISION":
        return <span className="badge badge-admin" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>Stipend Revision</span>;
      case "DEPARTMENT_TRANSFER":
        return <span className="badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.3)" }}>Dept Transfer</span>;
      case "MANAGER_CHANGE":
        return <span className="badge" style={{ background: "rgba(236, 72, 153, 0.15)", color: "#ec4899", border: "1px solid rgba(236, 72, 153, 0.3)" }}>Manager Reassignment</span>;
      case "PROJECT_ASSIGNED":
        return <span className="badge" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#0ea5e9", border: "1px solid rgba(14, 165, 233, 0.3)" }}>Project Assigned</span>;
      case "STATUS_CHANGE":
      case "ONBOARDING":
        return <span className="badge badge-active">Lifecycle & Status</span>;
      default:
        return <span className="badge">{eventType}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Internship Extensions
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "var(--color-primary)" }}>
            {summary.extension_count} {summary.extension_count === 1 ? "time" : "times"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            End Date: {formatDate(summary.current_end_date)}
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Dept & Manager Moves
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#a855f7" }}>
            {summary.department_transfer_count + summary.manager_change_count}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            {summary.department_transfer_count} transfers, {summary.manager_change_count} manager updates
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Projects Worked On
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#0ea5e9" }}>
            {summary.projects_count}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            {summary.tasks_completed_count} tasks completed
          </div>
        </div>

        {isAdmin && (
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Stipend Revisions
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#10b981" }}>
              {summary.stipend_revisions_count}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              Admin-only audit history
            </div>
          </div>
        )}
      </div>

      {/* 2. Projects History Section */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Projects Worked On History</h2>
        {projects_history.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--color-text-muted)", padding: "12px 0" }}>
            No project assignments recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects_history.map((p: any) => (
              <div key={p.id} style={{
                background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)", padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18, color: "#0ea5e9" }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                      Assigned on: {formatDate(p.assigned_at)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Timeline Filter & Events Sequence */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Career & Lifecycle Activity Sequence</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "ALL", label: "All Events" },
              { id: "PROMOTIONS", label: "Promotions" },
              { id: "EXTENSIONS", label: "Extensions" },
              ...(isAdmin ? [{ id: "STIPEND", label: "Stipend Revisions" }] : []),
              { id: "TRANSFERS", label: "Dept & Managers" },
              { id: "PROJECTS", label: "Projects" },
              { id: "STATUS", label: "Status Changes" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setCategoryFilter(btn.id)}
                className={`btn ${categoryFilter === btn.id ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "4px 12px", fontSize: 12 }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No history logs found</h3>
            <p>No activity matches the selected filter.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
            {filteredLogs.map((log: any) => (
              <div key={log.id} style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {getEventBadge(log.event_type)}
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{log.title}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--color-text-dim)", fontFamily: "monospace" }}>
                    {formatDate(log.created_at)}
                  </span>
                </div>

                {log.description && (
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                    {log.description}
                  </div>
                )}

                {(log.old_value || log.new_value) && (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(0,0,0,0.2)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    width: "fit-content",
                    fontSize: 13,
                    fontFamily: "monospace",
                    marginTop: 4,
                  }}>
                    <span style={{ color: "var(--color-text-dim)" }}>{log.old_value || "—"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14, color: "var(--color-primary)" }}>
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>{log.new_value || "—"}</span>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-dim)", marginTop: 4, paddingTop: 8, borderTop: "1px dashed var(--color-border)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx={12} cy={7} r={4} />
                  </svg>
                  Action performed by: <strong style={{ color: "var(--color-text)" }}>{log.performed_by?.full_name || "System Admin"}</strong>
                  {log.performed_by?.role && <span className="badge badge-manager" style={{ fontSize: 10, padding: "1px 6px" }}>{log.performed_by.role}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to auto-calculate internship duration from start and end dates
function calculateDuration(startDateStr?: string | null, endDateStr?: string): string {
  if (!endDateStr) return "6 Months";
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "6 Months";

  let monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() - start.getDate() >= 15) {
    monthDiff += 1;
  }

  if (monthDiff <= 0) monthDiff = 1;

  if (monthDiff === 12) return "1 Year";
  if (monthDiff === 24) return "2 Years";
  if (monthDiff % 12 === 0) return `${monthDiff / 12} Years`;
  return `${monthDiff} Month${monthDiff > 1 ? "s" : ""}`;
}

// ─── MODAL 1: Extend Internship Modal ──────────────────────────────────────────
function ExtendInternshipModal({ intern, onClose, onSuccess }: { intern: InternProfile; onClose: () => void; onSuccess: () => void }) {
  const [endDate, setEndDate] = useState(intern.end_date || "");
  const [duration, setDuration] = useState(
    intern.end_date ? calculateDuration(intern.joining_date, intern.end_date) : (intern.duration || "6 Months")
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleEndDateChange = (newEndDate: string) => {
    setEndDate(newEndDate);
    if (newEndDate) {
      const autoDur = calculateDuration(intern.joining_date, newEndDate);
      setDuration(autoDur);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endDate) {
      setError("Please select the new End Date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await internsApi.update(intern.id, {
        end_date: endDate,
        duration: duration,
        remarks: remarks ? `[Extension Note]: ${remarks}\n${intern.remarks || ""}` : intern.remarks,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to extend internship.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "var(--color-primary)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Extend Internship
          </h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Current End Date</label>
            <input className="form-input" value={formatDate(intern.end_date)} disabled style={{ opacity: 0.7 }} />
          </div>

          <div className="form-group">
            <label className="form-label">New Target End Date *</label>
            <input className="form-input" type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Updated Duration (Auto-Calculated)</label>
            <input
              className="form-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 6 Months"
              required
            />
            <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 4 }}>
              * Calculated automatically from joining date ({formatDate(intern.joining_date)}) to target end date.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Extension Reason / Remarks</label>
            <textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for extension (e.g. Project extension)..." />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Confirm Extension"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL 2: Revise Stipend Modal (Admin Only) ─────────────────────────────
function ReviseStipendModal({ intern, onClose, onSuccess }: { intern: InternProfile; onClose: () => void; onSuccess: () => void }) {
  const isUnpaid = !intern.is_paid || (intern.internship_type || "").toLowerCase() === "unpaid" || (intern.stipend_amount || 0) === 0;

  const [stipendAmount, setStipendAmount] = useState<string>(
    intern.stipend_amount !== undefined && intern.stipend_amount !== null && intern.stipend_amount > 0 ? String(intern.stipend_amount) : ""
  );
  const [isPaid, setIsPaid] = useState<boolean>(intern.is_paid !== false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUnpaid) {
      setError("Cannot revise stipend for an Unpaid intern. Please promote the intern to 'Paid' status (e.g. Intern (Paid)) first.");
      return;
    }
    if (!stipendAmount || isNaN(Number(stipendAmount)) || Number(stipendAmount) <= 0) {
      setError("Please enter a valid paid stipend amount (> 0).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await internsApi.update(intern.id, {
        stipend_amount: Number(stipendAmount),
        stipend_type: "monthly",
        is_paid: true,
        remarks: remarks ? `[Stipend Revision Note]: ${remarks}\n${intern.remarks || ""}` : intern.remarks,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to revise stipend.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: "#10b981" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Revise / Increment Stipend
          </h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {isUnpaid && (
          <div className="alert alert-warning" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6, border: "1px solid rgba(245, 158, 11, 0.4)", background: "rgba(245, 158, 11, 0.1)" }}>
            <div style={{ fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              ⚠️ Stipend Revision Restricted
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
              This candidate is currently <strong>Unpaid</strong>. You cannot revise stipend directly. Please promote the candidate to <strong>Intern (Paid)</strong> or <strong>Trainee</strong> using the <strong>Promote Candidate</strong> button first.
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Current Stipend</label>
            <div style={{
              padding: "10px 14px",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: 14,
              fontWeight: 600,
            }}>
              {intern.stipend_amount !== undefined && intern.stipend_amount !== null && intern.stipend_amount > 0 && intern.is_paid !== false ? `₹${Number(intern.stipend_amount).toLocaleString()} (Monthly)` : "Unpaid / Not set"}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Monthly Stipend Amount (₹) *</label>
            <input
              className="form-input"
              type="number"
              value={stipendAmount}
              onChange={(e) => setStipendAmount(e.target.value)}
              placeholder="e.g. 5000"
              disabled={isUnpaid}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Revision Remarks / Increment Reason</label>
            <textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for revision (e.g. Performance appraisal increment)..." disabled={isUnpaid} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || isUnpaid}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Confirm Revision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL 3: Transfer Department & Manager Modal ──────────────────────────────
function TransferDepartmentModal({ intern, onClose, onSuccess }: { intern: InternProfile; onClose: () => void; onSuccess: () => void }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [targetDeptId, setTargetDeptId] = useState(intern.department?.id || "");
  const [targetMgrId, setTargetMgrId] = useState(intern.reporting_manager?.id || "");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    departmentsApi.list().then(setDepartments).catch(() => {});
    adminApi.users().then((users) => {
      setManagers(users.filter((u) => u.role === "MANAGER"));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId) {
      setError("Please select a target department.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await internsApi.update(intern.id, {
        department_id: targetDeptId,
        reporting_manager_id: targetMgrId || undefined,
        remarks: remarks ? `[Transfer Request Note]: ${remarks}\n${intern.remarks || ""}` : intern.remarks,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to initiate transfer request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Transfer Department &amp; Manager
          </h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Target Department *</label>
            <select
              className="form-select"
              value={targetDeptId}
              onChange={(e) => {
                const newDeptId = e.target.value;
                setTargetDeptId(newDeptId);
                const deptMgrs = managers.filter((m) => m.department_id === newDeptId);
                if (deptMgrs.length > 0) {
                  setTargetMgrId(deptMgrs[0].id);
                } else {
                  setTargetMgrId("");
                }
              }}
              required
            >
              <option value="">-- Select Department --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Reporting Manager</label>
            <select
              className="form-select"
              value={targetMgrId}
              onChange={(e) => setTargetMgrId(e.target.value)}
            >
              <option value="">-- None / Select Manager --</option>
              {managers
                .filter((m) => !targetDeptId || m.department_id === targetDeptId)
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name} ({m.company_email})</option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Transfer Justification / Note</label>
            <textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for department transfer..." />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Request Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL 4: Promote Candidate Modal ──────────────────────────────────────────
function PromoteCandidateModal({ intern, onClose, onSuccess }: { intern: InternProfile; onClose: () => void; onSuccess: () => void }) {
  const currentCategory = (intern.category || "intern").toLowerCase();
  const isUnpaid = !intern.is_paid || (intern.internship_type || "").toLowerCase() === "unpaid";

  // Dynamic Allowed Target Categories based on promotion hierarchy matrix
  const getTargetCategoryOptions = () => {
    switch (currentCategory) {
      case "intern":
        if (isUnpaid) {
          return [
            { id: "intern_paid", label: "Intern (Paid)" },
            { id: "trainee", label: "Trainee (Paid Regular)" },
            { id: "contract", label: "Contract Basis (Paid)" },
            { id: "full_time", label: "Full-Time Regular Employee" },
          ];
        }
        return [
          { id: "trainee", label: "Trainee (Paid Regular)" },
          { id: "contract", label: "Contract Basis (Paid)" },
          { id: "full_time", label: "Full-Time Regular Employee" },
        ];
      case "trainee":
        return [
          { id: "contract", label: "Contract Basis (Paid)" },
          { id: "full_time", label: "Full-Time Regular Employee" },
        ];
      case "contract":
        return [
          { id: "full_time", label: "Full-Time Regular Employee" },
        ];
      default:
        return [];
    }
  };

  const targetOptions = getTargetCategoryOptions();
  const [targetCategory, setTargetCategory] = useState(targetOptions[0]?.id || "trainee");
  const [stipendAmount, setStipendAmount] = useState<string>(
    intern.stipend_amount && Number(intern.stipend_amount) > 0 ? String(intern.stipend_amount) : "5000"
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategory) {
      setError("Please select a target promotion category.");
      return;
    }
    if (!stipendAmount || isNaN(Number(stipendAmount)) || Number(stipendAmount) <= 0) {
      setError("Promotion to Paid status requires a valid compensation amount (> 0).");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const isInternPaid = targetCategory === "intern_paid";
      await internsApi.update(intern.id, {
        category: isInternPaid ? "intern" : targetCategory,
        internship_type: "paid",
        is_paid: true,
        stipend_amount: Number(stipendAmount),
        stipend_type: "monthly",
        remarks: remarks ? `[Promotion Note]: ${remarks}\n${intern.remarks || ""}` : intern.remarks,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to execute promotion.");
    } finally {
      setSaving(false);
    }
  };

  const currentPlacementText = `${currentCategory.toUpperCase()} (${isUnpaid ? "UNPAID" : "PAID"})${intern.title ? ` — ${intern.title}` : ""}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#a855f7", display: "flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
              <path d="M20 21H4" />
            </svg>
            Promote Candidate
          </h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Current Placement</label>
            <div style={{
              padding: "10px 14px",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.3px",
            }}>
              {currentPlacementText}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Promote To Category *</label>
            <select className="form-select" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} required>
              {targetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--color-text-dim)", marginTop: 4 }}>
              * Promoted candidates will be assigned Paid status with monthly compensation.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Compensation / Stipend (₹) *</label>
            <input
              className="form-input"
              type="number"
              value={stipendAmount}
              onChange={(e) => setStipendAmount(e.target.value)}
              placeholder="e.g. 25000"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Promotion Remarks / Justification</label>
            <textarea
              className="form-textarea"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Reason for promotion (e.g. Exceptional performance during internship)..."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Confirm Promotion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

