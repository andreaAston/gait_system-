import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getPatientsWithAssignments } from "@/lib/services/patients";
import type { PatientStatus } from "@/types/database";
import { calculateAge, formatPatientGender } from "@/lib/utils/patient";

const patientStatusStyles: Record<PatientStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  discharged: "bg-slate-50 text-slate-600 border-slate-200",
};

const patientStatusOrder: Record<PatientStatus, number> = {
  active: 0,
  discharged: 1,
  inactive: 2,
};

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
  const patients = await getPatientsWithAssignments();
  const sortedPatients = [...patients].sort(
    (first, second) =>
      patientStatusOrder[first.status] - patientStatusOrder[second.status] ||
      second.registered_at.localeCompare(first.registered_at)
  );
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
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-500">
            <DashboardIcon name="active" className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider">
              Gait monitoring
            </p>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Dashboard overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            A snapshot of patient status and recovery progress.
          </p>
        </div>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-2 text-sm font-medium bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
          New Patient
        </Link>
      </div>

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

      <section aria-labelledby="patient-list-heading">
        <div className="mb-4">
          <h2
            id="patient-list-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900"
          >
            <DashboardIcon
              name="patients"
              className="h-5 w-5 text-slate-500"
            />
            Patient list
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Age</th>
                <th className="px-5 py-3 font-medium">Gender</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Registered</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {patient.full_name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0).toUpperCase())
                          .join("")}
                      </span>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {patient.full_name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {calculateAge(patient.date_of_birth) ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatPatientGender(patient.gender)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border capitalize ${
                        patientStatusStyles[patient.status]
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          patient.status === "active"
                            ? "bg-emerald-500"
                            : patient.status === "discharged"
                              ? "bg-slate-400"
                              : "bg-amber-500"
                        }`}
                      />
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {new Date(patient.registered_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        className="h-4 w-4"
                      >
                        <path d="M1.8 10s3-5.5 8.2-5.5 8.2 5.5 8.2 5.5-3 5.5-8.2 5.5S1.8 10 1.8 10Z" />
                        <circle cx="10" cy="10" r="2.2" />
                      </svg>
                      View data
                    </Link>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    <span className="mb-2 flex justify-center">
                      <DashboardIcon
                        name="patients"
                        className="h-7 w-7 text-slate-300"
                      />
                    </span>
                    No patients registered yet.{" "}
                    <Link
                      href="/patients/new"
                      className="font-medium text-slate-700 underline underline-offset-4"
                    >
                      Register a patient
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
