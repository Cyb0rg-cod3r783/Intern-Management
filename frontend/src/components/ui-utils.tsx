export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE: { cls: "badge-active", label: "Active" },
    ALUMNI: { cls: "badge-alumni", label: "Alumni" },
    INACTIVE: { cls: "badge-inactive", label: "Inactive" },
    PENDING_APPROVAL: { cls: "badge-pending", label: "Pending" },
    REJECTED_BY_MANAGER: { cls: "badge-blocked", label: "Declined" },
    NOT_STARTED: { cls: "badge-not-started", label: "Not Started" },
    IN_PROGRESS: { cls: "badge-in-progress", label: "In Progress" },
    BLOCKED: { cls: "badge-blocked", label: "Blocked" },
    COMPLETED: { cls: "badge-completed", label: "Completed" },
    OVERDUE: { cls: "badge-overdue", label: "Overdue" },
    DRAFT: { cls: "badge-not-started", label: "Draft" },
    SUBMITTED: { cls: "badge-in-progress", label: "Submitted" },
    ACKNOWLEDGED: { cls: "badge-alumni", label: "Acknowledged" },
    LOW: { cls: "badge-low", label: "Low" },
    MEDIUM: { cls: "badge-medium", label: "Medium" },
    HIGH: { cls: "badge-high", label: "High" },
    ADMIN: { cls: "badge-admin", label: "Admin" },
    MANAGER: { cls: "badge-manager", label: "Manager" },
    INTERN: { cls: "badge-intern", label: "Intern" },
  };

  const entry = map[status] || { cls: "badge-not-started", label: status };
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
