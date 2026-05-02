import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smash",
  description: "Simple Next.js app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="sticky top-0 z-30 border-b border-black/10 bg-white/70 px-6 py-4 backdrop-blur-md dark:border-white/10 dark:bg-black/30">
          <ul className="mx-auto flex w-full max-w-7xl items-center gap-2 text-sm font-medium">
            <li>
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="rounded-md px-3 py-1.5 text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/kanji-list"
                className="rounded-md px-3 py-1.5 text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Kanji List
              </Link>
            </li>
            <li>
              <Link
                href="/training-list"
                className="rounded-md px-3 py-1.5 text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Training List
              </Link>
            </li>
            <li>
              <Link
                href="/smash"
                className="rounded-md px-3 py-1.5 text-black/75 transition hover:bg-black/5 hover:text-black dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
              >
                Smash
              </Link>
            </li>
          </ul>
        </nav>
        <main className="mx-auto flex w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
