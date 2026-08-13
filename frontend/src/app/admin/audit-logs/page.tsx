"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { auditApi, AuditLog } from "@/lib/api";
import { formatDateTime } from "@/components/ui-utils";

const ALL_ACTIONS = [
  "LOGIN", "LOGOUT", "VIEW_PROFILE", "VIEW_SENSITIVE_PROFILE",
  "CREATE_INTERN", "EDIT_INTERN", "EDIT_STIPEND", "VIEW_BANK_INFORMATION",
  "EXPORT_DATA", "CREATE_TASK", "UPDATE_TASK", "CREATE_HANDOVER",
  "ACKNOWLEDGE_HANDOVER", "DEACTIVATE_USER", "USER_CREATED",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    auditApi.list({ action: actionFilter || undefined, limit: 200 })
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [actionFilter]);

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Security and access event trail — Admin access only</p>
        </div>
      </div>

      <div className="filter-bar">
        <select id="audit-action-filter" className="form-select" style={{ width: 220 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-text-muted)" }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{log.actor_name || "System"}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-dim)", fontFamily: "monospace" }}>
                      {log.actor_email}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontFamily: "monospace", fontSize: 12,
                      padding: "3px 8px", borderRadius: 4,
                      background: getActionColor(log.action).bg,
                      color: getActionColor(log.action).fg,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {log.target_type && <span>{log.target_type}</span>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--color-text-dim)" }}>
                    {log.ip_address || "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                    {log.metadata && Object.keys(log.metadata).length > 0
                      ? <code style={{ fontSize: 11 }}>{JSON.stringify(log.metadata)}</code>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="empty-state"><h3>No audit logs found</h3></div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function getActionColor(action: string): { bg: string; fg: string } {
  if (action.includes("SENSITIVE") || action.includes("BANK") || action.includes("STIPEND"))
    return { bg: "rgba(239,68,68,0.12)", fg: "var(--color-danger)" };
  if (action.includes("LOGIN")) return { bg: "rgba(16,185,129,0.12)", fg: "var(--color-success)" };
  if (action.includes("CREATE")) return { bg: "rgba(59,130,246,0.12)", fg: "var(--color-primary)" };
  if (action.includes("EXPORT")) return { bg: "rgba(245,158,11,0.12)", fg: "var(--color-warning)" };
  if (action.includes("DEACTIVATE")) return { bg: "rgba(239,68,68,0.12)", fg: "var(--color-danger)" };
  return { bg: "rgba(100,116,139,0.12)", fg: "var(--color-text-muted)" };
}
