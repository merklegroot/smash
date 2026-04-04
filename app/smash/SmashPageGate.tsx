"use client";

import dynamic from "next/dynamic";

const SmashPageClient = dynamic(() => import("./SmashPageClient"), {
  ssr: false,
  loading: () => (
    <section
      className="flex min-h-[min(40vh,320px)] flex-1 items-center justify-center rounded-3xl border border-black/10 bg-white/40 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
      aria-hidden
    />
  ),
});

export default function SmashPageGate() {
  return <SmashPageClient />;
}
