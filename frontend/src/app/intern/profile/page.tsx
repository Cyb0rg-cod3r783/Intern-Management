"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { internsApi, InternProfile } from "@/lib/api";
import { StatusBadge, formatDate } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";

export default function InternProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<InternProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    internsApi.get(user.id)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <AppShell><div className="loading-overlay"><div className="spinner" /></div></AppShell>;
  if (!profile) return <AppShell><div className="alert alert-danger">Profile not found</div></AppShell>;

  return (
    <AppShell requiredRole="INTERN">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff",
          }}>
            {user?.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="page-title">{user?.full_name}</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-muted)" }}>{user?.company_email}</span>
              <StatusBadge status={profile.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>My Internship Details</h2>
        <div className="detail-grid">
          <div className="detail-item"><div className="detail-label">TK ID</div><div className="detail-value">{profile.new_tk_id || "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Department</div><div className="detail-value">{profile.department?.name || "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Reporting Manager</div><div className="detail-value">{profile.reporting_manager?.full_name || "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Category</div><div className="detail-value">{profile.category ? profile.category.toUpperCase() : "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Internship Type</div><div className="detail-value">{profile.internship_type ? profile.internship_type.toUpperCase() : "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Location</div><div className="detail-value">{profile.location || "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Duration</div><div className="detail-value">{profile.duration || "—"}</div></div>
          <div className="detail-item"><div className="detail-label">Joining Date</div><div className="detail-value">{formatDate(profile.joining_date)}</div></div>
          <div className="detail-item"><div className="detail-label">End Date</div><div className="detail-value">{formatDate(profile.end_date)}</div></div>
          <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><StatusBadge status={profile.status} /></div></div>
        </div>
        {profile.remarks && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>Remarks</div>
            <div style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.6 }}>{profile.remarks}</div>
          </div>
        )}
      </div>

      <div className="alert alert-warning" style={{ marginTop: 16 }}>
        To update your profile information, contact your reporting manager or admin.
      </div>
    </AppShell>
  );
}
