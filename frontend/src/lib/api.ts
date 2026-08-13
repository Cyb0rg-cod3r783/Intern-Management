/**
 * Typed API client for the Talakunchi Intern Management backend.
 *
 * Auth is cookie-based: the backend sets an httpOnly `tk_session` cookie on
 * login (never readable by JS, so an XSS bug can't exfiltrate it the way a
 * localStorage-stored token could) plus a JS-readable `tk_csrf` cookie used
 * as a CSRF token on state-changing requests (double-submit-cookie pattern).
 * Every request goes with `credentials: "include"` so the session cookie is
 * sent automatically; we never store or read a bearer token in JS.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Read the JS-readable CSRF cookie set alongside the httpOnly session cookie. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tk_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (MUTATING_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") {
        msg = err.detail;
      } else if (Array.isArray(err.detail)) {
        msg = err.detail.map((e: any) => `${e.loc?.slice(-1)[0] || 'field'}: ${e.msg || 'invalid'}`).join(", ");
      } else if (err.detail) {
        msg = JSON.stringify(err.detail);
      } else if (err.message) {
        msg = err.message;
      }
    } catch {}
    throw new ApiError(res.status, msg);
  }


  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: UserInfo }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getGoogleOAuthUrl: () =>
    request<{ url: string }>("/auth/google/url"),
  googleCallback: (code: string) =>
    request<{ user: UserInfo }>("/auth/google/callback", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  me: () => request<UserInfo>("/auth/me"),
  changePassword: (old_password: string, new_password: string) =>
    request<{ message: string }>("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ old_password, new_password }),
    }),
  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
    }),
};

// ─── Interns ───────────────────────────────────────────────────────────────────
export const internsApi = {
  list: (params?: { department_id?: string; status?: string; manager_id?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.manager_id) qs.set("manager_id", params.manager_id);
    if (params?.search) qs.set("search", params.search);
    return request<InternProfile[]>(`/interns/?${qs}`);
  },
  get: (internId: string) => request<InternProfile>(`/interns/${internId}`),
  create: (data: CreateInternRequest) =>
    request<InternProfile>("/interns/", { method: "POST", body: JSON.stringify(data) }),
  update: (internId: string, data: Partial<InternProfile>) =>
    request<InternProfile>(`/interns/${internId}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivate: (internId: string) =>
    request(`/interns/${internId}`, { method: "DELETE" }),
  deletePermanent: (internId: string) =>
    request(`/interns/${internId}/permanent`, { method: "DELETE" }),
  getHistory: (internId: string) =>
    request<InternHistoryResponse>(`/interns/${internId}/history`),
};

// ─── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { intern_id?: string; status?: string; priority?: string; overdue_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.intern_id) qs.set("intern_id", params.intern_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.overdue_only) qs.set("overdue_only", "true");
    return request<Task[]>(`/tasks/?${qs}`);
  },
  get: (taskId: string) => request<Task>(`/tasks/${taskId}`),
  create: (data: CreateTaskRequest) =>
    request<Task>("/tasks/", { method: "POST", body: JSON.stringify(data) }),
  update: (taskId: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(data) }),
  addProgressUpdate: (taskId: string, note: string) =>
    request(`/tasks/${taskId}/updates`, { method: "POST", body: JSON.stringify({ note }) }),
};

// ─── Handovers ─────────────────────────────────────────────────────────────────
export const handoversApi = {
  list: () => request<Handover[]>("/handovers/"),
  get: (id: string) => request<Handover>(`/handovers/${id}`),
  create: (data: CreateHandoverRequest) =>
    request<Handover>("/handovers/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Handover>) =>
    request<Handover>(`/handovers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: { status?: string; department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.department_id) qs.set("department_id", params.department_id);
    return request<Project[]>(`/projects/?${qs}`);
  },
  get: (id: string) => request<Project>(`/projects/${id}`),
  getTasks: (id: string) => request<Task[]>(`/projects/${id}/tasks`),
  create: (data: { name: string; description?: string; status?: string; start_date?: string; target_end_date?: string; department_id?: string }) =>
    request<Project>("/projects/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updatePhase: (id: string, phase: string) =>
    request<Project>(`/projects/${id}/phase`, { method: "PATCH", body: JSON.stringify({ phase }) }),
  assignInterns: (id: string, userIds: string[]) =>
    request<Project>(`/projects/${id}/assign-interns`, { method: "POST", body: JSON.stringify({ user_ids: userIds }) }),
  delete: (id: string) => request(`/projects/${id}`, { method: "DELETE" }),
};

// ─── Approvals ─────────────────────────────────────────────────────────────────
export const approvalsApi = {
  pending: () => request<ApprovalRequest[]>("/approvals/pending"),
  accept: (id: string) => request<ApprovalRequest>(`/approvals/${id}/accept`, { method: "POST" }),
  reject: (id: string, reason?: string) =>
    request<ApprovalRequest>(`/approvals/${id}/reject`, { method: "POST", body: JSON.stringify({ rejection_reason: reason }) }),
};

// ─── Departments ───────────────────────────────────────────────────────────────
export const departmentsApi = {
  list: () => request<Department[]>("/departments/"),
  listAll: () => request<Department[]>("/departments/all"),
  create: (data: { name: string; description?: string }) =>
    request<Department>("/departments/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Department>) =>
    request<Department>(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  analytics: () => request<AnalyticsData>("/admin/analytics"),
  users: () => request<UserInfo[]>("/admin/users"),
  managers: () => request<ManagerRef[]>("/admin/managers"),
  listManagers: () => request<ManagerRef[]>("/admin/managers"),
  createUser: (data: { company_email: string; full_name: string; role: string; initial_password?: string; department_id?: string }) =>
    request<UserInfo>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (userId: string, data: { full_name?: string; company_email?: string; role?: string; department_id?: string; is_active?: boolean }) =>
    request<UserInfo>(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${userId}`, { method: "DELETE" }),
  projectCosts: (params?: { timeframe?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.timeframe) qs.set("timeframe", params.timeframe);
    if (params?.start_date) qs.set("start_date", params.start_date);
    if (params?.end_date) qs.set("end_date", params.end_date);
    return request<ProjectCostResponse>(`/admin/analytics/project-costs?${qs}`);
  },
  departmentCosts: (params?: { timeframe?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.timeframe) qs.set("timeframe", params.timeframe);
    if (params?.start_date) qs.set("start_date", params.start_date);
    if (params?.end_date) qs.set("end_date", params.end_date);
    return request<DepartmentCostResponse>(`/admin/analytics/department-costs?${qs}`);
  },
  financialOverview: (params?: { timeframe?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.timeframe) qs.set("timeframe", params.timeframe);
    if (params?.start_date) qs.set("start_date", params.start_date);
    if (params?.end_date) qs.set("end_date", params.end_date);
    return request<FinancialOverviewResponse>(`/admin/analytics/financial-overview?${qs}`);
  },
  endingSoon: (days: number = 30) =>
    request<EndingSoonResponse>(`/admin/analytics/ending-soon?days=${days}`),
  projectTaskHealth: () =>
    request<ProjectTaskHealthResponse>("/admin/analytics/project-task-health"),
  projectDeepAnalytics: (projectId: string) =>
    request<ProjectDeepAnalyticsResponse>(`/admin/analytics/projects/${projectId}`),
  exportInterns: () =>
    fetch(`${API_BASE}/admin/export/interns`, { credentials: "include" }),
  exportTemplate: () =>
    fetch(`${API_BASE}/admin/export/bulk-template`, { credentials: "include" }),
  bulkImport: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const csrf = getCsrfToken();
    const res = await fetch(`${API_BASE}/admin/interns/bulk-import`, {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok && !data.errors) {
      throw new ApiError(res.status, data.detail || "Bulk import failed");
    }
    return data;
  },
  bulkDelete: (userIds: string[]) =>
    request<{ success: boolean; deleted_count: number; message: string }>("/admin/interns/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds }),
    }),
};

// ─── Manager Analytics ─────────────────────────────────────────────────────────
export const managerApi = {
  projectTaskHealth: () =>
    request<ProjectTaskHealthResponse>("/admin/manager/analytics/project-task-health"),
  endingSoon: (days: number = 30) =>
    request<EndingSoonResponse>(`/admin/manager/analytics/ending-soon?days=${days}`),
};

// ─── Daily Work Logs ───────────────────────────────────────────────────────────
export const dailyLogsApi = {
  submit: (data: {
    log_date?: string;
    total_hours: number;
    summary_notes?: string;
    entries: {
      task_id?: string;
      project_id?: string;
      hours_spent: number;
      description?: string;
      evidence_link?: string;
      new_task_status?: string;
    }[];
  }) => request<DailyLog>("/daily-logs/", { method: "POST", body: JSON.stringify(data) }),

  getMyLogs: (limit = 30) => request<DailyLog[]>(`/daily-logs/my?limit=${limit}`),

  getManagerLogs: (log_date?: string) =>
    request<ManagerDailyLogsResponse>(`/daily-logs/manager${log_date ? `?log_date=${log_date}` : ""}`),

  getAdminLogs: (log_date?: string) =>
    request<AdminDailyLogsResponse>(`/daily-logs/admin${log_date ? `?log_date=${log_date}` : ""}`),

  sendReminder: (internId: string) =>
    request<{ success: boolean; message: string }>(`/daily-logs/send-reminder/${internId}`, { method: "POST" }),

  getInternLogs: (internId: string, limit = 60) =>
    request<DailyLog[]>(`/daily-logs/intern/${internId}?limit=${limit}`),

  checkMissing: (target_date?: string) =>
    request<{ success: boolean; target_date: string; notified_managers_count: number }>(
      `/daily-logs/check-missing${target_date ? `?target_date=${target_date}` : ""}`,
      { method: "POST" }
    ),
};

// ─── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { action?: string; actor_id?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.set("action", params.action);
    if (params?.actor_id) qs.set("actor_id", params.actor_id);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return request<AuditLog[]>(`/audit/?${qs}`);
  },
};

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => request<NotificationListResponse>("/notifications/"),
  markAllRead: () => request<{ message: string }>("/notifications/read-all", { method: "PUT" }),
  markRead: (id: string) => request<{ message: string }>(`/notifications/${id}/read`, { method: "PUT" }),
};

// ─── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "ADMIN" | "MANAGER" | "INTERN";

export interface UserInfo {
  id: string;
  company_email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  department_id?: string;
  created_at?: string;
}

export interface ManagerRef {
  id: string;
  full_name: string;
  company_email: string;
  department_id?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface UserRef {
  id: string;
  full_name: string;
  company_email: string;
  role: string;
}

export interface InternProfile {
  id: string;
  user_id: string;
  full_name?: string;
  company_email?: string;
  new_tk_id?: string;
  old_tk_id?: string;
  department?: Department;
  reporting_manager?: ManagerRef;
  title?: string;
  category?: string;
  location?: string;
  internship_type?: string;
  duration?: string;
  joining_date?: string;
  end_date?: string;
  status: "ACTIVE" | "ALUMNI" | "INACTIVE" | "PENDING_APPROVAL" | "REJECTED_BY_MANAGER";
  remarks?: string;
  // Admin-only (undefined for non-admins)
  personal_email?: string;
  personal_phone?: string;
  marital_status?: string;
  stipend_amount?: number;
  stipend_type?: string;
  is_paid?: boolean;
  bank_name?: string;
  bank_ifsc?: string;
  bank_account_number?: string;
  payment_info_extra?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateInternRequest {
  full_name: string;
  company_email: string;
  new_tk_id?: string;
  old_tk_id?: string;
  department_id?: string;
  reporting_manager_id?: string;
  title?: string;
  category?: string;
  location?: string;
  internship_type?: string;
  duration?: string;
  joining_date?: string;
  end_date?: string;
  remarks?: string;
  personal_email?: string;
  personal_phone?: string;
  marital_status?: string;
  stipend_amount?: number;
  stipend_type?: string;
  is_paid?: boolean;
  bank_account_number?: string;
  bank_name?: string;
  bank_ifsc?: string;
  initial_password?: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  note: string;
  created_at: string;
}

export interface Task {
  id: string;
  intern_id: string;
  intern_name?: string;
  assigned_by_id?: string;
  assigned_by_name?: string;
  project_id?: string;
  project_name?: string;
  title: string;
  description?: string;
  assigned_date?: string;
  due_date?: string;
  completed_date?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  evidence_link?: string;
  is_overdue: boolean;
  updates: TaskUpdate[];
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  intern_id?: string;
  project_id?: string;
  title: string;

  description?: string;
  assigned_date?: string;
  due_date?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  status?: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
  evidence_link?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ON_HOLD";
  start_date?: string;
  target_end_date?: string;
  department_id?: string;
  department?: Department;
  interns: UserRef[];
  task_count: number;
  completed_task_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalRequest {
  id: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  tk_id?: string;
  request_type: "ONBOARDING" | "DEPARTMENT_TRANSFER";
  current_department?: Department;
  target_department?: Department;
  requested_by_name: string;
  assigned_manager_name: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Handover {
  id: string;
  outgoing_intern_id: string;
  outgoing_intern_name?: string;
  receiving_person_id?: string;
  receiving_person_name?: string;
  initiated_by_id: string;
  initiated_by_name?: string;
  status: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "ACKNOWLEDGED" | "COMPLETED";
  summary?: string;
  important_notes?: string;
  doc_links?: string;
  repo_pr_links?: string;
  context?: string;
  completed_tasks?: unknown[];
  pending_tasks?: unknown[];
  created_at: string;
  updated_at: string;
}

export interface CreateHandoverRequest {
  outgoing_intern_id: string;
  receiving_person_id?: string;
  summary?: string;
  important_notes?: string;
  doc_links?: string;
  repo_pr_links?: string;
  context?: string;
  completed_tasks?: unknown[];
  pending_tasks?: unknown[];
}

export interface AnalyticsData {
  interns: {
    total: number;
    active: number;
    alumni: number;
    inactive: number;
    paid: number;
    unpaid: number;
    ending_soon_30_days: number;
  };
  by_department: { name: string; count: number }[];
  tasks: {
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    overdue: number;
    completion_rate: number;
  };
  financial: {
    total_monthly_stipend: number;
    paid_interns: number;
    unpaid_interns: number;
  };
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  notification_type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  unread_count: number;
  notifications: NotificationItem[];
}

export interface InternHistoryLogItem {
  id: string;
  intern_profile_id: string;
  user_id: string;
  event_type: string;
  title: string;
  description?: string;
  old_value?: string;
  new_value?: string;
  extra_metadata?: Record<string, any>;
  performed_by?: {
    id: string;
    full_name: string;
    company_email: string;
    role: string;
  };
  is_sensitive: boolean;
  created_at: string;
}

export interface ProjectHistoryItem {
  id: string;
  name: string;
  status: string;
  assigned_at?: string;
}

export interface TaskHistorySummary {
  total_assigned: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
}

export interface InternHistoryResponse {
  summary: {
    extension_count: number;
    department_transfer_count: number;
    manager_change_count: number;
    stipend_revisions_count: number;
    projects_count: number;
    tasks_completed_count: number;
    joining_date?: string;
    current_end_date?: string;
    current_status: string;
  };
  projects_history: ProjectHistoryItem[];
  tasks_summary: TaskHistorySummary;
  logs: InternHistoryLogItem[];
}

export interface ProjectCostAssignedIntern {
  id: string;
  user_id: string;
  full_name: string;
  company_email: string;
  stipend_amount: number;
  is_paid: boolean;
}

export interface ProjectCostItem {
  id: string;
  name: string;
  description?: string;
  status: string;
  department_id?: string;
  department_name: string;
  interns_count: number;
  monthly_cost: number;
  calculated_cost: number;
  assigned_interns: ProjectCostAssignedIntern[];
}

export interface ProjectCostResponse {
  timeframe: string;
  period_label: string;
  multiplier: number;
  total_projects: number;
  total_monthly_cost: number;
  total_timeframe_cost: number;
  average_project_cost: number;
  projects: ProjectCostItem[];
}

export interface DepartmentCostItem {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  interns_count: number;
  monthly_cost: number;
  calculated_cost: number;
  assigned_interns: ProjectCostAssignedIntern[];
}

export interface DepartmentCostResponse {
  timeframe: string;
  period_label: string;
  multiplier: number;
  total_departments: number;
  total_active_interns: number;
  total_monthly_cost: number;
  total_timeframe_cost: number;
  average_department_cost: number;
  departments: DepartmentCostItem[];
}

export interface FinancialOverviewResponse {
  timeframe: string;
  period_label: string;
  multiplier: number;
  total_active_interns: number;
  paid_interns: number;
  unpaid_interns: number;
  monthly_stipend_total: number;
  calculated_stipend_total: number;
  average_stipend_per_paid_intern: number;
}

export interface EndingSoonCandidate {
  id: string;
  user_id: string;
  full_name: string;
  company_email?: string;
  new_tk_id?: string;
  old_tk_id?: string;
  category: string;
  internship_type: string;
  is_paid: boolean;
  stipend_amount: number;
  department_id?: string;
  department_name: string;
  reporting_manager_name: string;
  joining_date?: string;
  end_date?: string;
  days_remaining: number;
  urgency_level: "CRITICAL" | "WARNING" | "INFO";
}

export interface EndingSoonResponse {
  days_window: number;
  total_ending: number;
  critical_count_7_days: number;
  paid_ending_count: number;
  unpaid_ending_count: number;
  ending_stipend_total: number;
  candidates: EndingSoonCandidate[];
}

export interface ProjectTaskHealthItem {
  id: string;
  name: string;
  description?: string;
  department_name: string;
  team_count: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  health_status: "ON_TRACK" | "AT_RISK" | "COMPLETED";
}

export interface ProjectTaskHealthResponse {
  overall_projects: number;
  projects_on_track: number;
  projects_at_risk: number;
  projects_completed: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  blocked_tasks: number;
  overall_completion_rate: number;
  projects: ProjectTaskHealthItem[];
}

export interface DailyLogEntry {
  id: string;
  task_id?: string;
  task_title?: string;
  project_id?: string;
  project_name?: string;
  hours_spent: number;
  description?: string;
  evidence_link?: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  intern_id: string;
  intern_name: string;
  intern_email: string;
  department_id?: string;
  department_name?: string;
  log_date: string;
  total_hours: number;
  summary_notes?: string;
  created_at: string;
  updated_at: string;
  entries: DailyLogEntry[];
}

export interface ManagerTeamDailySummary {
  intern_id: string;
  profile_id: string;
  intern_name: string;
  company_email: string;
  new_tk_id?: string;
  has_logged_today: boolean;
  total_hours_today: number;
  latest_log_date?: string;
  latest_log_id?: string;
}

export interface ManagerDailyLogsResponse {
  target_date: string;
  total_team_members: number;
  logged_count: number;
  missing_count: number;
  team_summary: ManagerTeamDailySummary[];
  logs: DailyLog[];
}

export interface AdminDailyLogsResponse {
  target_date: string;
  total_active_interns: number;
  total_logged_today: number;
  total_hours_logged: number;
  logs: DailyLog[];
}

export interface ProjectContributor {
  intern_id: string;
  intern_name: string;
  company_email: string;
  new_tk_id?: string;
  tasks_assigned: number;
  tasks_completed: number;
  hours_logged: number;
  effort_share_pct: number;
  monthly_stipend: number;
}

export interface ProjectRecentUpdateNote {
  id: string;
  task_id: string;
  task_title?: string;
  author_name: string;
  note: string;
  created_at: string;
}

export interface ProjectDeepAnalyticsResponse {
  id: string;
  name: string;
  description?: string;
  status: string;
  phase: string;
  health_status: "ON_TRACK" | "AT_RISK" | "COMPLETED";
  department_name: string;
  start_date?: string;
  target_end_date?: string;
  total_team_members: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  total_updates_count: number;
  total_man_hours_logged: number;
  monthly_burn_cost: number;
  contributors: ProjectContributor[];
  recent_updates: ProjectRecentUpdateNote[];
}
