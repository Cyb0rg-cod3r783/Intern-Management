"use client";
import { useState } from "react";
import { authApi } from "@/lib/api";
import PasswordInput from "@/components/PasswordInput";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setSuccess("Password updated successfully!");
      setTimeout(() => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("");
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>Change Password</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Current Password *</label>
            <PasswordInput value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">New Password *</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="At least 6 characters" />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
