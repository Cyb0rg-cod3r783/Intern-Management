"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { internsApi, departmentsApi, adminApi, InternProfile, Department, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function EditInternPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const internId = params.id as string;
  const [intern, setIntern] = useState<InternProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Operational fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("intern");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("3 Months");
  const [joiningDate, setJoiningDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");

  // Admin-only sensitive fields
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [internshipType, setInternshipType] = useState("paid");
  const [stipendAmount, setStipendAmount] = useState<string>("");
  const [stipendType, setStipendType] = useState("monthly");
  const [isPaid, setIsPaid] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      internsApi.get(internId),
      departmentsApi.list().catch(() => []),
      isAdmin ? adminApi.managers().catch(() => []) : Promise.resolve([]),
    ])
      .then(([p, depts, mgrs]) => {
        setIntern(p);
        setDepartments(depts);
        setManagers(mgrs);

        setTitle(p.title || "");
        setCategory(p.category || "intern");
        setLocation(p.location || "");
        setDuration(p.duration || "3 Months");
        setJoiningDate(p.joining_date || "");
        setEndDate(p.end_date || "");
        setRemarks(p.remarks || "");
        setDepartmentId(p.department?.id || "");
        setReportingManagerId(p.reporting_manager?.id || "");

        setPersonalEmail(p.personal_email || "");
        setPersonalPhone(p.personal_phone || "");
        setInternshipType(p.internship_type || "paid");
        setStipendAmount(p.stipend_amount !== undefined && p.stipend_amount !== null ? String(p.stipend_amount) : "");
        setStipendType(p.stipend_type || "monthly");
        setIsPaid(p.is_paid !== false);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [internId, isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const payload: Partial<InternProfile> & Record<string, any> = {
        title,
        location,
        remarks,
        duration,
      };

      if (endDate) payload.end_date = endDate;

      if (isAdmin) {
        payload.category = category;
        payload.internship_type = internshipType;
        if (joiningDate) payload.joining_date = joiningDate;
        if (departmentId) payload.department_id = departmentId;
        if (reportingManagerId) payload.reporting_manager_id = reportingManagerId;

        if (personalEmail) payload.personal_email = personalEmail;
        if (personalPhone) payload.personal_phone = personalPhone;
        if (internshipType === "unpaid") {
          payload.stipend_amount = 0;
          payload.is_paid = false;
        } else {
          payload.is_paid = isPaid;
          payload.stipend_type = stipendType;
          if (stipendAmount !== "") payload.stipend_amount = Number(stipendAmount);
        }
      }

      await internsApi.update(internId, payload);
      setSuccess("Profile updated successfully. History timeline auto-recorded.");
      setTimeout(() => router.push(`/admin/interns/${internId}`), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell><div className="loading-overlay"><div className="spinner" /></div></AppShell>;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Intern Profile</h1>
          <p className="page-subtitle">{intern?.full_name} ({intern?.company_email})</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Basic / Operational Info */}
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
            {isAdmin ? "Operational Details & Placement" : "Operational Details (Manager View)"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Software Engineer Intern" />
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">Select Location</option>
                <option value="Andheri">Andheri</option>
                <option value="Dombivali">Dombivali</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Duration</label>
              <select className="form-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="1 Month">1 Month</option>
                <option value="2 Months">2 Months</option>
                <option value="3 Months">3 Months</option>
                <option value="6 Months">6 Months</option>
                <option value="1 Year">1 Year</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">End Date (Extension Target)</label>
              <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            {isAdmin && (
              <>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="trainee">Trainee</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Joining Date</label>
                  <input className="form-input" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Department Assignment</label>
                  <select className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reporting Manager</label>
                  <select className="form-select" value={reportingManagerId} onChange={(e) => setReportingManagerId(e.target.value)}>
                    <option value="">Select Manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.company_email})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Operational Remarks</label>
              <textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Operational remarks or extension notes…" />
            </div>
          </div>
        </div>

        {/* Admin Only Sensitive Info */}
        {isAdmin && (
          <div className="sensitive-section" style={{ marginTop: 0 }}>
            <div className="sensitive-header" style={{ marginBottom: 20 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Admin-Only Financial & Personal Information
              <span className="badge badge-admin" style={{ marginLeft: "auto" }}>Admin Only</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Internship Type</label>
                <select className="form-select" value={internshipType} onChange={(e) => setInternshipType(e.target.value)}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              {internshipType !== "unpaid" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Stipend Amount (₹)</label>
                    <input className="form-input" type="number" value={stipendAmount} onChange={(e) => setStipendAmount(e.target.value)} placeholder="e.g. 15000" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stipend Frequency</label>
                    <select className="form-select" value={stipendType} onChange={(e) => setStipendType(e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="one-time">One-Time</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Personal Email</label>
                <input className="form-input" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="e.g. john.doe@gmail.com" />
              </div>

              <div className="form-group">
                <label className="form-label">Personal Phone Number</label>
                <input className="form-input" type="tel" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} placeholder="+91 9876543210" />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Save Changes"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
