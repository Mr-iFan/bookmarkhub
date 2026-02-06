"use client";

import { useEffect, useRef, useState } from "react";

type NoticeTone = "info" | "warn" | "error";

export interface NoticeState {
  message: string;
  tone: NoticeTone;
  id: number;
}

export const useNotice = () => {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const idRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = (message: string, tone: NoticeTone, duration = 3200) => {
    clearTimer();
    idRef.current += 1;
    setNotice({ message, tone, id: idRef.current });
    timerRef.current = setTimeout(() => {
      setNotice(null);
    }, duration);
  };

  const clearNotice = () => {
    clearTimer();
    setNotice(null);
  };

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return {
    notice,
    showInfo: (message: string, duration?: number) => show(message, "info", duration),
    showWarn: (message: string, duration?: number) => show(message, "warn", duration),
    showError: (message: string, duration?: number) => show(message, "error", duration),
    clearNotice,
  };
};

interface NoticeBarProps {
  notice: NoticeState | null;
}

export const NoticeBar = ({ notice }: NoticeBarProps) => {
  if (!notice) return null;

  const toneStyles: Record<NoticeTone, string> = {
    info: "border-[#94a3b8]",
    warn: "border-[#f59e0b]",
    error: "border-[#dc2626]",
  };

  const dotStyles: Record<NoticeTone, string> = {
    info: "bg-[#94a3b8]",
    warn: "bg-[#f59e0b]",
    error: "bg-[#dc2626]",
  };

  return (
    <div
      className={`fixed right-4 top-4 z-30 flex items-center gap-2 rounded border border-dashed bg-white/90 px-4 py-2 text-sm text-slate-800 shadow-sm ${toneStyles[notice.tone]}`}
      role="status"
      aria-live="polite"
      key={notice.id}
    >
      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${dotStyles[notice.tone]}`} aria-hidden />
      <span>{notice.message}</span>
    </div>
  );
};
