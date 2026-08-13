"use client";

import { useState, InputHTMLAttributes } from "react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "Enter password",
  className = "form-input",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <style>{`
        input::-ms-reveal,
        input::-ms-clear,
        input::-webkit-contacts-auto-fill-button,
        input::-webkit-credentials-auto-fill-button {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `}</style>
      <input
        {...props}
        id={id}
        type={showPassword ? "text" : "password"}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingRight: 40, ...(props.style || {}) }}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        tabIndex={-1}
        title={showPassword ? "Hide password" : "Show password"}
        aria-label={showPassword ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          borderRadius: 4,
          transition: "color var(--transition)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim)")}
      >
        {showPassword ? (
          // Eye Off Icon (password visible -> click to hide)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1={1} y1={1} x2={23} y2={23} />
          </svg>
        ) : (
          // Eye Icon (password hidden -> click to show)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx={12} cy={12} r={3} />
          </svg>
        )}
      </button>
    </div>
  );
}
