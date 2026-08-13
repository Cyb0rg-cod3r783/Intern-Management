"use client";

import { useTheme } from "@/lib/theme-context";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      className="btn btn-secondary btn-icon"
      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
      aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: "var(--radius-md)",
        transition: "all var(--transition)",
      }}
    >
      {theme === "dark" ? (
        // Sun Icon for Light Mode option
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 18, height: 18, color: "#f59e0b" }}
        >
          <circle cx={12} cy={12} r={5} />
          <line x1={12} y1={1} x2={12} y2={3} />
          <line x1={12} y1={21} x2={12} y2={23} />
          <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
          <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
          <line x1={1} y1={12} x2={3} y2={12} />
          <line x1={21} y1={12} x2={23} y2={12} />
          <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
          <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
        </svg>
      ) : (
        // Moon Icon for Dark Mode option
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 18, height: 18, color: "#6366f1" }}
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
