"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

let _dispatch: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;

export function toast(message: string, variant: ToastVariant = "info") {
  if (!_dispatch) return;
  const id = `${Date.now()}-${Math.random()}`;
  _dispatch((prev) => [...prev, { id, message, variant }]);
  setTimeout(() => {
    _dispatch?.((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _dispatch = setToasts;
    return () => {
      _dispatch = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 300,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const styles =
          t.variant === "error"
            ? { bg: "var(--red-bg)", border: "var(--red-border)", color: "var(--red)" }
            : t.variant === "success"
              ? { bg: "var(--green-bg)", border: "var(--green-border)", color: "var(--green)" }
              : { bg: "var(--bg)", border: "var(--border)", color: "var(--text-1)" };
        return (
          <div
            key={t.id}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13.5,
              maxWidth: 340,
              background: styles.bg,
              border: `1px solid ${styles.border}`,
              color: styles.color,
              boxShadow: "var(--shadow-md)",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
