"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  confirmTone?: "primary" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  confirmTone = "primary",
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const confirmClass =
    confirmTone === "destructive" ? "v-btn" : "v-btn v-btn-primary";
  const confirmStyle: React.CSSProperties =
    confirmTone === "destructive"
      ? {
          borderColor: "var(--red-border)",
          color: "var(--red)",
          background: "var(--red-bg)",
        }
      : {};

  return (
    <div
      onClick={() => {
        if (!busy) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        background: "rgba(17, 17, 16, 0.32)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "var(--shadow-md)",
          maxWidth: 440,
          width: "calc(100vw - 32px)",
          padding: "20px 24px 16px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: "-0.2px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--text-2)",
            lineHeight: 1.55,
            marginBottom: 18,
          }}
        >
          {body}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="v-btn v-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={confirmClass}
            style={confirmStyle}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
