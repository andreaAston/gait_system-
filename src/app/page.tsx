import { AppShell } from "@/components/AppShell";
import { getPatientsWithAssignments } from "@/lib/services/patients";
import { createClient } from "@/lib/supabase/server";

const welcomeQuotes = [
  {
    text: "An ounce of prevention is worth a pound of cure.",
    author: "Benjamin Franklin",
  },
  {
    text: "The good physician treats the disease; the great physician treats the patient who has the disease.",
    author: "William Osler",
  },
  {
    text: "I attribute my success to this: I never gave or took any excuse.",
    author: "Florence Nightingale",
  },
  {
    text: "Life is short, the art long; opportunity fleeting, experience treacherous, judgment difficult.",
    author: "Hippocrates, Aphorisms",
  },
];

type DashboardIconName = "patients" | "active" | "discharged" | "inactive";

function DashboardIcon({
  name,
  className,
}: {
  name: DashboardIconName;
  className: string;
}) {
  const paths: Record<DashboardIconName, React.ReactNode> = {
    patients: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    active: (
      <>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
        <path d="M3.5 12h5l2-3 3 6 2-3h5" />
      </>
    ),
    discharged: (
      <>
        <path d="M3 7h13l5 5v5H3z" />
        <path d="M16 7v5h5M7 17h.01M17 17h.01" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="17.5" cy="17.5" r="1.5" />
      </>
    ),
    inactive: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l2.5 2.5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const [
    patients,
    {
      data: { user },
    },
  ] = await Promise.all([
    getPatientsWithAssignments(),
    supabase.auth.getUser(),
  ]);
  const rawDisplayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0];
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim()
      ? rawDisplayName.trim()
      : null;
  const loginSeed = `${user?.id ?? "guest"}:${user?.last_sign_in_at ?? "session"}`;
  const quoteSeed = Array.from(loginSeed).reduce(
    (seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0,
    0
  );
  const welcomeQuote = welcomeQuotes[quoteSeed % welcomeQuotes.length];
  const activeCount = patients.filter(
    (patient) => patient.status === "active"
  ).length;
  const inactiveCount = patients.filter(
    (patient) => patient.status === "inactive"
  ).length;
  const dischargedCount = patients.filter(
    (patient) => patient.status === "discharged"
  ).length;

  const stats = [
    {
      label: "Total Patients",
      value: patients.length,
      detail: "Registered patients",
      icon: "patients" as const,
      iconStyle: "bg-sky-50 text-sky-700",
    },
    {
      label: "Active Patients",
      value: activeCount,
      detail: "Currently in care",
      icon: "active" as const,
      iconStyle: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Discharged Patients",
      value: dischargedCount,
      detail: "Previous assignment ended",
      icon: "discharged" as const,
      iconStyle: "bg-slate-100 text-slate-600",
    },
    {
      label: "Inactive Patients",
      value: inactiveCount,
      detail: "Not currently assigned",
      icon: "inactive" as const,
      iconStyle: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <AppShell>
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Gait monitoring
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Welcome back{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Here&apos;s your patient overview for today.
            </p>
            <blockquote className="mt-6 border-l-2 border-cyan-400 pl-4">
              <p className="text-sm leading-relaxed text-slate-100 sm:text-base">
                “{welcomeQuote.text}”
              </p>
              <footer className="mt-2 text-xs font-medium text-cyan-200">
                — {welcomeQuote.author}
              </footer>
            </blockquote>
          </div>
          <div
            aria-hidden="true"
            className="hidden h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-white/5 sm:flex"
          >
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-14 w-14 text-cyan-300"
            >
              <path d="M24 42s-17-10.5-17-23a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 12.5-17 23-17 23Z" />
              <path d="M9 24h10l3-6 5 13 3-7h9" />
            </svg>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/5"
        />
        <div
          aria-hidden="true"
          className="absolute -right-4 -top-12 h-48 w-48 rounded-full border border-white/5"
        />
      </section>

      <section
        aria-label="Patient statistics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4"
          >
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-3xl font-semibold text-slate-900 mt-2">
                {stat.value}
              </p>
              <p className="text-xs text-slate-400 mt-1">{stat.detail}</p>
            </div>
            <span
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
            >
              <DashboardIcon name={stat.icon} className="h-5 w-5" />
            </span>
          </div>
        ))}
      </section>

    </AppShell>
  );
}
