# GAIT Monitoring Dashboard

A web dashboard for managing patient records and monitoring gait sensor data. The app uses Next.js App Router, React, Tailwind CSS, and Supabase for authentication and data storage.

## Features

- Authenticated dashboard with patient totals by assignment status.
- Patient registration with full name, date of birth, gender, and optional notes.
- Age calculated from the date of birth.
- Patient detail pages with recent readings and assignment history.
- Device registration and patient assignment management.
- Assignment-derived patient statuses: active while assigned, inactive before first assignment, and discharged after an assignment ends.
- Historical gait charts with CSV export.
- Responsive, collapsible navigation and a System info guide to patient and device workflows.
- Supabase-backed authentication and database access.

## Requirements

- Node.js and npm
- A Supabase project with the app's database schema and row-level security policies configured

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your Supabase project credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   These are public client credentials intended to be used with Supabase Row Level Security. Do not put a Supabase service-role key in a `NEXT_PUBLIC_` variable.

3. Apply the database schema in your Supabase project. For an existing database, apply these migrations in order:

   ```text
   supabase/migrations/20261017220500_add_patient_demographics.sql
   supabase/migrations/20261017224000_assignment_driven_patient_status.sql
   supabase/migrations/20261018173000_add_assignment_crutch_side.sql
   supabase/migrations/20261018180000_enable_reading_values_realtime.sql
   ```

   Run the migrations in order using the Supabase SQL Editor or your configured Supabase CLI workflow before using patient demographics, assignment-driven statuses, crutch-side selection, or live sensor updates.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign in with an account created by a Supabase administrator.

## Demo data

For a prototype database, `supabase/seed_demo_data.sql` clears existing operational data and inserts four fictional patients plus one demo device: one Active, two Discharged, and one Inactive. It clears patient records, devices, assignments, gait readings, and reading values; it preserves sensor definitions and Supabase Auth accounts. The single demo device has sequential assignments for Demo Patient 02 and Demo Patient 03, then a current assignment for Demo Patient 01. Demo Patient 04 is Inactive. The Discharged patients each have their own assignment period and sample reading data. Assignment rows include the selected crutch side.

`supabase/seed_demo_readings.sql` creates heel, midfoot, and forefoot force sensors plus crutch vibration and handle-load sensors for both sides, then adds 15 minutes of sample readings for the active assignment and both discharged assignments. The patient graph compares left-foot/crutch readings in the top panel with right-foot/crutch readings below, sharing the time range. It replaces gait readings only for `DEMO-GAIT-001`. Apply all four migrations above, then run `seed_demo_data.sql` followed by `seed_demo_readings.sql`.

**Warning:** Running `seed_demo_data.sql` is destructive and replaces operational patient/device/readings data. Review the SQL and ensure all migrations have been applied before running it in the Supabase SQL Editor. A physical device can only be actively assigned to one patient at a time.

## Patient readings

The patient detail page plots the left foot/crutch sensors in a top panel and the right foot/crutch sensors in a bottom panel, with a shared time axis. Each panel includes heel, midfoot, and forefoot forces and the matching crutch vibration and handle load when configured; hovering either panel shows its sensor values. Force uses the left axis in newtons; vibration uses a separate right axis in its configured unit. The graph scrolls horizontally on narrow screens. Active assignments default to live readings for the last 15 minutes; users can select 1-hour, 24-hour, or custom ranges and switch assignment history. Historical readings are clipped to the selected assignment period.

## Project structure

```text
src/
  app/
    devices/       Device registration and assignments
    patients/      Patient list, registration, details, and history
    system-info/   Explanation of the patient and device workflow
    login/         Supabase sign-in
  components/      Shared layout, status, charts, and CSV export
  lib/
    services/      Supabase data access
    supabase/      Browser, server, and middleware clients
    utils/         Patient age and device status helpers
  types/           Database/domain types
supabase/
  migrations/      Database migrations
  seed_demo_data.sql
```

## Useful commands

```bash
npm run dev       # Start the local development server
npm run lint      # Run ESLint
npm run build     # Create a production build
npm run start     # Start the production server
```
