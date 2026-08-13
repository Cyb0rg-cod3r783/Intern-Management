"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const { user, isAdmin, isManager } = useAuth();
  const pathname = usePathname();

  const getSectionTitle = () => {
    if (pathname.includes("/dashboard")) return "Dashboard Overview";
    if (pathname.includes("/interns")) return "Intern Directory & Profiles";
    if (pathname.includes("/managers")) return "User & Role Management";
    if (pathname.includes("/tasks")) return "Task Tracking & Execution";
    if (pathname.includes("/handovers")) return "Knowledge & Handover Portal";
    if (pathname.includes("/departments")) return "Department Directory";
    if (pathname.includes("/audit-logs")) return "Security Audit Logs";
    return "Talakunchi Portal";
  };

  const roleBadgeText = isAdmin ? "Admin Portal" : isManager ? "Manager Portal" : "Intern Portal";

  return (
    <header className="top-header">
      <div className="top-header-left">
        <span className="top-header-badge">{roleBadgeText}</span>
        <span className="top-header-sep">•</span>
        <span className="top-header-section">{getSectionTitle()}</span>
      </div>

      <div className="top-header-right">
        <NotificationBell />
        <ThemeToggle />
        <div className="top-header-user">
          <div className="top-header-avatar">
            {user?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <span className="top-header-username">{user?.full_name}</span>
        </div>
      </div>
    </header>
  );
}
