"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="h-12 rounded-xl bg-navy text-subtitle font-bold text-white">
      🖨 {label}
    </button>
  );
}
