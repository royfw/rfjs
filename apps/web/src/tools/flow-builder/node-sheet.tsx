"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@rfjs/web-ui/components/button";

/**
 * 輕量右側滑出面板(slide-over)—— 內嵌的編輯器(ConfigFormBuilder / FilterTreeEditor)
 * 太大,塞不進窄側欄,所以點節點時用寬抽屜編輯,canvas 維持全寬。
 * 關閉:背景點擊 / X / Esc。無額外相依(不需 radix dialog)。
 */
export function NodeSheet({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,860px)] flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          <Button size="icon" variant="ghost" aria-label={closeLabel} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    </>
  );
}
