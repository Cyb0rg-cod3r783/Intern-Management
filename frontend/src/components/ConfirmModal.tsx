"use client";
import { ReactNode } from "react";

interface Props {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = true,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {isDanger && (
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.12)", color: "var(--color-danger)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1={12} y1={9} x2={12} y2={13}/>
                <line x1={12} y1={17} x2={12.01} y2={17}/>
              </svg>
            </div>
          )}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>{title}</h2>
        </div>

        <div style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
          {message}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button
            className={`btn ${isDanger ? "btn-danger" : "btn-primary"}`}
            style={isDanger ? { background: "var(--color-danger)", color: "#fff", border: "none" } : {}}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
