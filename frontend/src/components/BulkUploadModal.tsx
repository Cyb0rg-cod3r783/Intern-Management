"use client";
import { useState, useRef } from "react";
import { adminApi, ApiError } from "@/lib/api";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RowError {
  row: number;
  email: string;
  errors: string[];
}

export default function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [validationErrors, setValidationErrors] = useState<RowError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const res = await adminApi.exportTemplate();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interns_bulk_template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setErrorMsg("Failed to download template.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    setSuccessMsg("");
    setValidationErrors([]);
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg("Please select a CSV or Excel file to upload.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setValidationErrors([]);

    try {
      const res = await adminApi.bulkImport(file);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.message || "Import validation failed.");
        if (res.errors) {
          setValidationErrors(res.errors);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to import file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            📥 Bulk Import Interns (CSV / Excel)
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-dim)",
              cursor: "pointer",
              padding: 6,
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color var(--transition), background var(--transition)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text)";
              e.currentTarget.style.background = "var(--color-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-dim)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file containing intern details. All <strong>16 columns</strong> are strictly required for every row.
        </p>

        {/* Template download notice */}
        <div style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)" }}>Standard CSV Template</div>
            <div style={{ fontSize: 12, color: "var(--color-text-dim)" }}>Includes all 16 required column headers & sample data</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate}>
            📄 Download Template
          </button>
        </div>

        {errorMsg && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{errorMsg}</div>}
        {successMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

        {/* File Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--color-surface-2)",
            transition: "all var(--transition)",
            marginBottom: 20,
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv, .xlsx, .xls"
            style={{ display: "none" }}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 40, height: 40, color: "var(--color-primary)", marginBottom: 12, display: "block" }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>
            {file ? file.name : "Click or drag & drop file to upload"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 4 }}>
            Supported formats: .csv, .xlsx
          </div>
        </div>

        {/* Validation Errors Table */}
        {validationErrors.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-danger)", marginBottom: 8 }}>
              ⚠️ Row Validation Errors ({validationErrors.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Row #</th>
                    <th>Email / ID</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {validationErrors.map((errItem, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>Line {errItem.row}</td>
                      <td>{errItem.email}</td>
                      <td style={{ color: "var(--color-danger)" }}>
                        {errItem.errors.join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button id="btn-submit-bulk-import" type="button" className="btn btn-primary" onClick={handleUpload} disabled={loading || !file}>
            {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Import File"}
          </button>
        </div>
      </div>
    </div>
  );
}
