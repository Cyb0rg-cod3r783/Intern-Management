"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { internsApi, InternProfile } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

import PendingApprovalsBucket from "@/components/PendingApprovalsBucket";

export default function MyInternsPage() {
  const { user } = useAuth();
  const [interns, setInterns] = useState<InternProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInterns = () => {
    if (!user) return;
    internsApi.list({ manager_id: user.id })
      .then(setInterns)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInterns();
  }, [user]);

  return (
    <AppShell requiredRole="MANAGER">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Interns</h1>
          <p className="page-subtitle">{interns.length} intern{interns.length !== 1 ? "s" : ""} assigned to you</p>
        </div>
      </div>

      <PendingApprovalsBucket onApprovalHandled={fetchInterns} />

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        interns.length === 0 ? (
          <div className="empty-state">
            <h3>No interns assigned</h3>
            <p>Ask your Admin to assign interns to you as their reporting manager.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {interns.map((intern) => (
              <div key={intern.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 800, color: "#fff",
                  }}>
                    {intern.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{intern.full_name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{intern.company_email}</div>
                  </div>
                  <StatusBadge status={intern.status} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                  <InfoRow label="Department" value={intern.department?.name || "—"} />
                  <InfoRow label="TK ID" value={intern.new_tk_id || "—"} />
                  <InfoRow label="End Date" value={formatDate(intern.end_date)} />
                  <InfoRow label="Location" value={intern.location || "—"} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Link href={`/manager/interns/${intern.user_id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>View Profile</Link>
                  <Link href={`/manager/interns/${intern.user_id}/edit`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, color: "var(--color-text)" }}>{value}</div>
    </div>
  );
}
