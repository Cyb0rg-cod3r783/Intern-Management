"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ChangePasswordModal from "@/components/ChangePasswordModal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}



const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: <GridIcon /> },
  { label: "Projects", href: "/admin/projects", icon: <FolderIcon /> },
  { label: "Interns", href: "/admin/interns", icon: <UsersIcon /> },
  { label: "Departments", href: "/admin/departments", icon: <BuildingIcon /> },
  { label: "Managers", href: "/admin/managers", icon: <UserCheckIcon /> },
  { label: "Tasks", href: "/admin/tasks", icon: <CheckSquareIcon /> },
  { label: "Handovers", href: "/admin/handovers", icon: <ArrowRightIcon /> },
  { label: "Analytics", href: "/admin/analytics", icon: <BarChartIcon /> },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: <ShieldIcon /> },
];

const managerNav: NavItem[] = [
  { label: "Dashboard", href: "/manager/dashboard", icon: <GridIcon /> },
  { label: "Daily Work Logs", href: "/manager/daily-logs", icon: <ClockIcon /> },
  { label: "Projects", href: "/manager/projects", icon: <FolderIcon /> },
  { label: "My Interns", href: "/manager/my-interns", icon: <UserCheckIcon /> },
  { label: "Tasks", href: "/manager/tasks", icon: <CheckSquareIcon /> },
  { label: "Handovers", href: "/manager/handovers", icon: <ArrowRightIcon /> },
];

const internNav: NavItem[] = [
  { label: "Dashboard", href: "/intern/dashboard", icon: <GridIcon /> },
  { label: "Daily Work Logs", href: "/intern/daily-logs", icon: <ClockIcon /> },
  { label: "My Projects", href: "/intern/projects", icon: <FolderIcon /> },
  { label: "My Profile", href: "/intern/profile", icon: <UserIcon /> },
  { label: "My Tasks", href: "/intern/tasks", icon: <CheckSquareIcon /> },
];

export default function Sidebar() {
  const { user, logout, isAdmin, isManager } = useAuth();
  const pathname = usePathname();

  const navItems = isAdmin ? adminNav : isManager ? managerNav : internNav;
  const roleLabel = isAdmin ? "Admin" : isManager ? "Manager" : "Intern";

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ padding: "20px 24px 16px" }}>
        <img
          src="/logo.png"
          alt="Talakunchi Digi-Info-Security"
          className="brand-logo-img"
          style={{ height: 32, marginBottom: 8 }}
        />
        <div className="sidebar-logo-mark" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em", color: "var(--color-primary)", textTransform: "uppercase" }}>
          Intern Hub
        </div>
      </div>


      <nav className="nav-section" style={{ flex: 1, paddingTop: 8 }}>
        <div className="nav-section-label" style={{ marginTop: 8 }}>{roleLabel} Menu</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">
            {user?.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.full_name}
            </div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn btn-secondary btn-icon"
            title="Change password"
            style={{ width: 32, height: 32, padding: 0, borderRadius: "var(--radius-md)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <KeyIcon />
          </button>
          <button
            onClick={logout}
            className="btn btn-secondary btn-icon"
            title="Sign out"
            style={{ width: 32, height: 32, padding: 0, borderRadius: "var(--radius-md)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </aside>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" />
      <circle cx={16.5} cy={7.5} r={1} fill="currentColor" />
    </svg>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function GridIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/></svg>;
}
function FolderIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx={12} cy={7} r={4}/></svg>;
}
function UserCheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={8.5} cy={7} r={4}/><polyline points="17 11 19 13 23 9"/></svg>;
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>;
}
function BuildingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={2} y={7} width={20} height={14} rx={1}/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>;
}
function CheckSquareIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
}
function ArrowRightIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={5} y1={12} x2={19} y2={12}/><polyline points="12 5 19 12 12 19"/></svg>;
}
function BarChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={20} x2={18} y2={10}/><line x1={12} y1={20} x2={12} y2={4}/><line x1={6} y1={20} x2={6} y2={14}/></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1={21} y1={12} x2={9} y2={12}/></svg>;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10}/><polyline points="12 6 12 12 16 14"/></svg>;
}
