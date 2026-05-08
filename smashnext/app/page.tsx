"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TAURI === "1") {
      router.replace("/smash");
    }
  }, [router]);

  return (
    <section className="flex flex-1 items-center justify-center">
      <h1 className="text-3xl font-semibold">Home</h1>
    </section>
  );
}
