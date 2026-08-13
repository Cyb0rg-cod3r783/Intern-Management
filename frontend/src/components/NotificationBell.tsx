"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi, NotificationItem } from "@/lib/api";
import { formatDateTime } from "@/components/ui-utils";
import { useAuth } from "@/lib/auth-context";

function cleanTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/[\u{1F300}-\u{1F9FF}\u{2300}-\u{23FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE00}-\u{FE0F}]/gu, "")
    .trim();
}

function getNotificationIcon(type: string, title: string) {
  const t = (type || "").toUpperCase();
  const titleLower = (title || "").toLowerCase();

  // 1. Sensitive Data Alert
  if (t === "SENSITIVE_DATA" || titleLower.includes("sensitive")) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
    );
  }

  // 2. Accepted / Confirmed / Completed
  if (
    t.includes("ACCEPTED") ||
    t === "TASK_COMPLETED" ||
    titleLower.includes("accepted") ||
    titleLower.includes("confirmed") ||
    titleLower.includes("completed")
  ) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
    );
  }

  // 3. Declined / Rejected / Blocked / Overdue
  if (
    t.includes("REJECTED") ||
    t === "BLOCKED_TASK" ||
    t === "OVERDUE" ||
    titleLower.includes("declined") ||
    titleLower.includes("rejected") ||
    titleLower.includes("blocked") ||
    titleLower.includes("overdue")
  ) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
    );
  }

  // 4. Transfer / Department / Onboarding Requests
  if (
    t.includes("TRANSFER") ||
    t === "APPROVAL_REQUEST" ||
    titleLower.includes("transfer") ||
    titleLower.includes("onboarding")
  ) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(99, 102, 241, 0.15)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </div>
    );
  }

  // 5. Tasks / Progress Updates / Feedback
  if (
    t.includes("TASK") ||
    t.includes("UPDATE") ||
    t.includes("FEEDBACK") ||
    titleLower.includes("task") ||
    titleLower.includes("feedback")
  ) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(6, 182, 212, 0.15)", color: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      </div>
    );
  }

  // 6. User Account Management
  if (t.includes("ACCOUNT") || titleLower.includes("account") || titleLower.includes("user")) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  // Fallback: Bell Icon
  return (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(99, 102, 241, 0.12)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </div>
  );
}

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.list();
      setUnreadCount(res.unread_count);
      setNotifications(res.notifications);
    } catch (err: any) {
      if (err?.status === 401) {
        setUnreadCount(0);
        setNotifications([]);
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      notificationsApi.markRead(item.id).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary btn-icon"
        title="Notifications"
        aria-label="Notifications"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: "var(--radius-md)",
          position: "relative",
          transition: "all var(--transition)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 18, height: 18, color: "var(--color-primary)" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "var(--color-danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              height: 16,
              minWidth: 16,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 0 0 2px var(--color-surface)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "120%",
          right: 0,
          width: 370,
          maxHeight: 460,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)",
          zIndex: 1100,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--color-surface-2)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-admin" style={{ fontSize: 11, padding: "1px 7px" }}>{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--color-text-dim)", fontSize: 13 }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: item.is_read ? "transparent" : "rgba(99, 102, 241, 0.06)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  {getNotificationIcon(item.notification_type, item.title)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: item.is_read ? 600 : 700, fontSize: 13, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cleanTitle(item.title)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-text-dim)", flexShrink: 0 }}>
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
                      {item.message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
