"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { handoversApi, internsApi, Handover, InternProfile, ApiError } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import { safeHref } from "@/lib/utils";

export default function HandoversPage() {
  const { user, isAdmin, isManager } = useAuth();
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [myInterns, setMyInterns] = useState<InternProfile[]>([]);
  const [form, setForm] = useState({
    outgoing_intern_id: "", receiving_person_id: "", summary: "",
    important_notes: "", doc_links: "", repo_pr_links: "", context: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    handoversApi.list()
      .then(setHandovers)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isManager && user) {
      internsApi.list({ manager_id: user.id }).then(setMyInterns);
    } else if (isAdmin) {
      internsApi.list().then(setMyInterns);
    }
  }, [isManager, isAdmin, user]);

  const handleCreate = async () => {
    setError("");
    if (!form.outgoing_intern_id) { setError("Select an intern for the handover."); return; }
    setSaving(true);
    try {
      await handoversApi.create({
        outgoing_intern_id: form.outgoing_intern_id,
        receiving_person_id: form.receiving_person_id || undefined,
        summary: form.summary || undefined,
        important_notes: form.important_notes || undefined,
        doc_links: form.doc_links || undefined,
        repo_pr_links: form.repo_pr_links || undefined,
        context: form.context || undefined,
      });
      setShowCreate(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    await handoversApi.update(id, { status: status as any });
    load();
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Handovers</h1>
          <p className="page-subtitle">Manual intern task handover management</p>
        </div>
        {(isAdmin || isManager) && (
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            + New Handover
          </button>
        )}
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <strong>Manual Process:</strong> Handovers are always manager-initiated. Tasks are never automatically reassigned.
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Create Handover</h2>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Outgoing Intern *</label>
                <select className="form-select" value={form.outgoing_intern_id} onChange={(e) => setForm(f => ({ ...f, outgoing_intern_id: e.target.value }))}>
                  <option value="">Select Intern</option>
                  {myInterns.map((i) => <option key={i.user_id} value={i.user_id}>{i.full_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Receiving Person</label>
                <input className="form-input" value={form.receiving_person_id} onChange={(e) => setForm(f => ({ ...f, receiving_person_id: e.target.value }))} placeholder="Receiving person ID (optional)" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Summary of Work</label>
              <textarea className="form-textarea" value={form.summary} onChange={(e) => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Summary of completed work…" />
            </div>
            <div className="form-group">
              <label className="form-label">Important Notes</label>
              <textarea className="form-textarea" value={form.important_notes} onChange={(e) => setForm(f => ({ ...f, important_notes: e.target.value }))} placeholder="Important context, warnings, or notes… (Do NOT include passwords or credentials)" />
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Documentation Links</label>
                <input className="form-input" value={form.doc_links} onChange={(e) => setForm(f => ({ ...f, doc_links: e.target.value }))} placeholder="https://docs.example.com/…" />
              </div>
              <div className="form-group">
                <label className="form-label">Repository / PR Links</label>
                <input className="form-input" value={form.repo_pr_links} onChange={(e) => setForm(f => ({ ...f, repo_pr_links: e.target.value }))} placeholder="https://github.com/…" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Additional Context</label>
              <textarea className="form-textarea" value={form.context} onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))} placeholder="Any additional context for the receiving person…" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Create Handover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : handovers.length === 0 ? (
        <div className="empty-state"><h3>No handovers found</h3></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {handovers.map((h) => (
            <div key={h.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {h.outgoing_intern_name} → {h.receiving_person_name || "TBD"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
                    Initiated by {h.initiated_by_name} · {formatDate(h.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusBadge status={h.status} />
                  {h.status !== "COMPLETED" && (isAdmin || isManager) && (
                    <select
                      className="form-select"
                      style={{ width: 160, fontSize: 13 }}
                      value={h.status}
                      onChange={(e) => setStatus(h.id, e.target.value)}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="SUBMITTED">Submitted</option>
                      <option value="ACKNOWLEDGED">Acknowledged</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  )}
                </div>
              </div>

              {h.summary && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Summary</div>
                  <div style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.6 }}>{h.summary}</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                {h.doc_links && <LinkPill label="Docs" href={h.doc_links} />}
                {h.repo_pr_links && <LinkPill label="Repository/PR" href={h.repo_pr_links} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function LinkPill({ label, href }: { label: string; href: string }) {
  return (
    <a href={safeHref(href)} target="_blank" rel="noopener noreferrer"
      className="badge badge-in-progress" style={{ textDecoration: "none", cursor: "pointer" }}>
      {label} ↗
    </a>
  );
}
