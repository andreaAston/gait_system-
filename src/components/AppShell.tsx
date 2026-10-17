"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/devices", label: "Devices" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:h-14 sm:gap-4 sm:py-0">
          <Link
            href="/"
            aria-label="GAIT dashboard"
            className="inline-flex items-center gap-1.5 justify-self-start text-lg font-bold tracking-tight text-slate-900"
          >
            GAIT
            <svg
              aria-label="Medical cross"
              role="img"
              viewBox="0 0 20 20"
              className="h-4 w-4 text-cyan-500"
              fill="currentColor"
            >
              <path d="M7.5 1.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z" />
            </svg>
          </Link>
          <nav className="flex items-center justify-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2 py-1.5 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={handleSignOut}
            className="justify-self-end whitespace-nowrap text-xs sm:text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
