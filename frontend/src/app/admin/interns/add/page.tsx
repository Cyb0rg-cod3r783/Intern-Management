"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { internsApi, departmentsApi, adminApi, Department, ManagerRef, CreateInternRequest, ApiError } from "@/lib/api";
import PasswordInput from "@/components/PasswordInput";

const calcDuration = (startStr?: string, endStr?: string): string => {
  if (!startStr || !endStr) return "";
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return "";
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const months = Math.round(diffDays / 30);
  return months >= 1 ? `${months} Month${months > 1 ? "s" : ""}` : `${diffDays} Day${diffDays > 1 ? "s" : ""}`;
};

export default function AddInternPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<ManagerRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<CreateInternRequest>({
    full_name: "",
    company_email: "",
    new_tk_id: "",
    category: "intern",
    location: "",
    internship_type: "paid",
    duration: "",
    joining_date: "",
    end_date: "",
    remarks: "",
    personal_email: "",
    personal_phone: "",
    stipend_amount: undefined,
    initial_password: "",
  });

  useEffect(() => {
    Promise.all([departmentsApi.list(), adminApi.managers()])
      .then(([d, m]) => { setDepartments(d); setManagers(m); })
      .catch((err: ApiError) => setError(err.message || "Failed to load form options"));
  }, []);

  const handleDepartmentChange = (deptId: string) => {
    const matchingManager = managers.find((m) => m.department_id === deptId);
    setForm((f) => ({
      ...f,
      department_id: deptId,
      ...(matchingManager ? { reporting_manager_id: matchingManager.id } : {}),
    }));
  };

  const set = (key: keyof CreateInternRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    if (key === "department_id") {
      handleDepartmentChange(value as string);
    } else {
      setForm((f) => {
        const next = { ...f, [key]: value };
        if (key === "joining_date" || key === "end_date") {
          const autoDur = calcDuration(
            key === "joining_date" ? (value as string) : f.joining_date,
            key === "end_date" ? (value as string) : f.end_date
          );
          if (autoDur) next.duration = autoDur;
        }
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const em = form.company_email.toLowerCase().trim();
    if (!em.endsWith("@talakunchi.com") && !em.endsWith("@talakunchi.in")) {
      setError("Company email must be a @talakunchi.com or @talakunchi.in address.");
      return;
    }

    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }

    setLoading(true);
    try {
      const isUnpaid = form.internship_type === "unpaid";
      const intern = await internsApi.create({
        ...form,
        stipend_amount: isUnpaid ? 0 : (form.stipend_amount ? Number(form.stipend_amount) : undefined),
        personal_email: form.personal_email || undefined,
        personal_phone: form.personal_phone || undefined,
        initial_password: form.initial_password || undefined,
      });
      setSuccess("Intern created successfully!");
      setTimeout(() => router.push(`/admin/interns/${intern.user_id}`), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create intern.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell requiredRole="ADMIN">
      <div className="page-header">
        <div>
          <h1 className="page-title">Add New Intern</h1>
          <p className="page-subtitle">Create a new intern account and profile</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 20 }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Section 1: Basic Information */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>Basic Information</h2>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-tk-id">TK ID</label>
              <input id="new-tk-id" className="form-input" value={form.new_tk_id || ""} onChange={set("new_tk_id")} placeholder="TK-2024-001" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="full-name">Full Name *</label>
              <input id="full-name" className="form-input" value={form.full_name} onChange={set("full_name")} placeholder="First Last" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="company-email">Email *</label>
              <input id="company-email" className="form-input" type="email" value={form.company_email} onChange={set("company_email")} placeholder="name@talakunchi.in" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="joining-date">Joining Date</label>
              <input id="joining-date" className="form-input" type="date" value={form.joining_date || ""} onChange={set("joining_date")} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="end-date">End Date</label>
              <input id="end-date" className="form-input" type="date" value={form.end_date || ""} onChange={set("end_date")} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="duration">Duration (Auto-Calculated)</label>
              <input id="duration" className="form-input" value={form.duration || ""} onChange={set("duration")} placeholder="Calculated from dates (e.g. 3 Months)" />
            </div>
          </div>
        </div>

        {/* Section 2: Organizational Information */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--color-text)" }}>Organizational Information</h2>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="department">Department</label>
              <select id="department" className="form-select" value={form.department_id || ""} onChange={set("department_id")}>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reporting-manager">Reporting Manager</label>
              <select id="reporting-manager" className="form-select" value={form.reporting_manager_id || ""} onChange={set("reporting_manager_id")}>
                <option value="">Select Manager</option>
                {managers.map((m) => {
                  const dept = departments.find((d) => d.id === m.department_id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.full_name}{dept ? ` — ${dept.name}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <select id="category" className="form-select" value={form.category || "intern"} onChange={set("category")}>
                <option value="trainee">Trainee</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="internship-type">Internship Type</label>
              <select id="internship-type" className="form-select" value={form.internship_type || "paid"} onChange={set("internship_type")}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="location">Location</label>
              <select id="location" className="form-select" value={form.location || ""} onChange={set("location")}>
                <option value="">Select Location</option>
                <option value="Andheri">Andheri</option>
                <option value="Dombivali">Dombivali</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="remarks">Remarks</label>
              <textarea id="remarks" className="form-textarea" value={form.remarks || ""} onChange={set("remarks")} placeholder="Any operational remarks…" />
            </div>
          </div>
        </div>

        {/* Section 3: Sensitive — Admin only section */}
        <div className="sensitive-section">
          <div className="sensitive-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Admin-Only — Sensitive Personal & Financial Information
            <span className="badge badge-admin" style={{ marginLeft: "auto" }}>Admin Only</span>
          </div>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="personal-email">Personal Email</label>
              <input id="personal-email" className="form-input" type="email" value={form.personal_email || ""} onChange={set("personal_email")} placeholder="personal@gmail.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="personal-phone">Personal Phone Number</label>
              <input id="personal-phone" className="form-input" type="tel" value={form.personal_phone || ""} onChange={set("personal_phone")} placeholder="+91 9876543210" />
            </div>
            {form.internship_type !== "unpaid" && (
              <div className="form-group">
                <label className="form-label" htmlFor="stipend-amount">Stipend (₹)</label>
                <input id="stipend-amount" className="form-input" type="number" step="0.01" value={form.stipend_amount || ""} onChange={set("stipend_amount")} placeholder="0.00" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="initial-password">Password *</label>
              <PasswordInput id="initial-password" value={form.initial_password || ""} onChange={set("initial_password")} placeholder="Password for email dashboard login" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
          <button id="btn-create-intern" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : "Create Intern"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
