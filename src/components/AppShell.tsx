"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

const SIDEBAR_EVENT = "gait-sidebar-change";

const navItems = [
  { href: "/", label: "Home", icon: "dashboard" },
  { href: "/patients", label: "Patients", icon: "patients" },
  { href: "/devices", label: "Devices", icon: "devices" },
  { href: "/system-info", label: "System info", icon: "info" },
] as const;

type NavIconName = (typeof navItems)[number]["icon"];

function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem("gait-sidebar-collapsed") === "true";
}

function getServerSidebarSnapshot() {
  return false;
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "dashboard") {
    return (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    );
  }

  if (name === "patients") {
    return (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    );
  }

  if (name === "devices") {
    return (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>
    );
  }

  return (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1.1-1.9 1.5-1.9 3.3M12 17h.01" />
    </>
  );
}

function Brand({
  compact = false,
  collapsed = false,
}: {
  compact?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="GAIT dashboard"
      title={collapsed ? "GAIT dashboard" : undefined}
      className={`inline-flex items-center gap-1.5 font-bold tracking-tight ${
        compact ? "text-lg text-slate-900" : "text-xl text-white"
      }`}
    >
      <span className={collapsed ? "hidden" : "max-md:hidden"}>GAIT</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={compact ? "h-4 w-4 text-cyan-500" : "h-4 w-4 text-cyan-400"}
        fill="currentColor"
      >
        <path d="M7.5 1.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z" />
      </svg>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getServerSidebarSnapshot
  );

  function toggleSidebar() {
    window.localStorage.setItem("gait-sidebar-collapsed", String(!collapsed));
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.push("/login");
    router.refresh();
  }

  const desktopSidebarWidth = collapsed ? "md:w-16" : "md:w-56";
  const mainOffset = collapsed ? "md:ml-16" : "md:ml-56";

  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-14 flex-col bg-slate-950 text-white transition-[width] duration-200 ${desktopSidebarWidth}`}
      >
        <div
          className={`flex h-16 items-center ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <Brand collapsed={collapsed} />
        </div>

        <div className="hidden px-2 pb-3 md:block">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-9 w-full items-center rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white ${
              collapsed ? "justify-center" : "justify-between px-3"
            }`}
          >
            {!collapsed && <span>Collapse sidebar</span>}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 ${collapsed ? "" : "rotate-180"}`}
            >
              <path d="m14 18-6-6 6-6" />
            </svg>
          </button>
        </div>

        {!collapsed && (
          <p className="mb-4 px-4 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 max-md:hidden">
            Gait monitoring
          </p>
        )}

        <nav aria-label="Main navigation" className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                  collapsed
                    ? "justify-center px-0"
                    : "justify-start px-3 max-md:justify-center max-md:px-0"
                } ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active ? "text-cyan-400" : "text-slate-400"
                  }`}
                >
                  <NavIcon name={item.icon} />
                </svg>
                <span
                  className={
                    collapsed
                      ? "hidden"
                      : "max-md:hidden"
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`mt-auto border-t border-slate-800 p-2 ${
            collapsed ? "" : "md:px-3 md:py-4"
          }`}
        >
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className={`flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white ${
              collapsed
                ? "justify-center px-0"
                : "justify-start px-3 max-md:justify-center max-md:px-0"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[18px] w-[18px] shrink-0 text-slate-400"
            >
              <path d="M10 17l5-5-5-5M15 12H3" />
              <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
            <span className={collapsed ? "hidden" : "max-md:hidden"}>
              Sign out
            </span>
          </button>
        </div>
      </aside>

      <main
        className={`min-h-screen min-w-0 transition-[margin] duration-200 ${mainOffset} ml-14`}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
