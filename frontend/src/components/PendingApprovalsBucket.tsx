"use client";
import { useEffect, useState, useCallback } from "react";
import { approvalsApi, ApprovalRequest } from "@/lib/api";
import { formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";

interface PendingApprovalsBucketProps {
  onApprovalHandled?: () => void;
}

export default function PendingApprovalsBucket({ onApprovalHandled }: PendingApprovalsBucketProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject Modal state
  const [rejectingItem, setRejectingItem] = useState<ApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchPending = useCallback(async () => {
    if (!user) return;
    try {
      const data = await approvalsApi.pending();
      setRequests(data);
    } catch (e: any) {
      if (e?.status !== 401) console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchPending();
  }, [user, fetchPending]);

  const handleAccept = async (req: ApprovalRequest) => {
    try {
      await approvalsApi.accept(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (onApprovalHandled) onApprovalHandled();
    } catch (err: any) {
      alert(err.message || "Failed to accept approval request.");
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      await approvalsApi.reject(rejectingItem.id, rejectionReason.trim() || undefined);
      setRequests((prev) => prev.filter((r) => r.id !== rejectingItem.id));
      setRejectingItem(null);
      setRejectionReason("");
      if (onApprovalHandled) onApprovalHandled();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reject approval request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 24,
        background: "linear-gradient(135deg, var(--color-surface) 0%, rgba(99, 102, 241, 0.04) 100%)",
        border: "1px solid rgba(99, 102, 241, 0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "rgba(99, 102, 241, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary)",
            }}
          >
            <ClockIcon />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              Pending Approvals &amp; Transfers
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
              {requests.length} request{requests.length > 1 ? "s" : ""} requiring your review
            </p>
          </div>
        </div>
        <span
          style={{
            background: "rgba(99, 102, 241, 0.12)",
            color: "var(--color-primary)",
            padding: "4px 10px",
            borderRadius: 16,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {requests.length} Pending
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {requests.map((req) => {
          const isOnboarding = req.request_type === "ONBOARDING";
          return (
            <div
              key={req.id}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 260, flex: 1 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: isOnboarding
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : "linear-gradient(135deg, #3b82f6, #6366f1)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {req.intern_name?.[0]?.toUpperCase() || "I"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                      {req.intern_name}
                    </span>
                    {req.tk_id && (
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-text-dim)", background: "var(--color-surface-2)", padding: "1px 6px", borderRadius: 4 }}>
                        {req.tk_id}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: isOnboarding ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
                        color: isOnboarding ? "#10b981" : "#3b82f6",
                      }}
                    >
                      {isOnboarding ? "New Onboarding" : "Department Transfer"}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>Email: {req.intern_email}</span>
                    <span>•</span>
                    {isOnboarding ? (
                      <span>Department: <strong>{req.target_department?.name || "Unassigned"}</strong></span>
                    ) : (
                      <span>
                        Transfer: <strong>{req.current_department?.name || "None"}</strong> ➔ <strong>{req.target_department?.name || "New Dept"}</strong>
                      </span>
                    )}
                    <span>•</span>
                    <span>Requested by {req.requested_by_name} ({formatDate(req.created_at)})</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: "#10b981", borderColor: "#10b981" }}
                  onClick={() => handleAccept(req)}
                >
                  <CheckIcon /> Accept
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  onClick={() => {
                    setRejectingItem(req);
                    setRejectionReason("");
                    setErrorMsg("");
                  }}
                >
                  <XIcon /> Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setRejectingItem(null); }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                  <XIcon />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Decline Request</h2>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                    Decline {rejectingItem.request_type === "ONBOARDING" ? "onboarding" : "transfer"} for {rejectingItem.intern_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 18 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRejectSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Reason for Declining (Optional / Feedback for Admin)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Current team capacity full, or candidate fits different department scope..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ resize: "vertical", minHeight: 80 }}
                />
              </div>

              {errorMsg && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
                  {errorMsg}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRejectingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: "#ef4444", borderColor: "#ef4444" }} disabled={submitting}>
                  {submitting ? "Submitting..." : "Confirm Decline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
