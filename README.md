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

3. Apply the database schema in your Supabase project. For an existing database, apply both migrations in order:

   ```text
   supabase/migrations/20261017220500_add_patient_demographics.sql
   supabase/migrations/20261017224000_assignment_driven_patient_status.sql
   ```

   Run the migrations using the Supabase SQL Editor or your configured Supabase CLI workflow before using patient demographics or assignment-driven statuses.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign in with an account created by a Supabase administrator.

## Demo data

For a prototype database, `supabase/seed_demo_data.sql` clears existing operational data and inserts 10 fictional patient records plus one demo device. It clears patient records, devices, assignments, gait readings, and reading values; it preserves sensor definitions and Supabase Auth accounts. The demo device is actively assigned to Demo Patient 01 and has an ended assignment for Demo Patient 10, to demonstrate Active and Discharged statuses. The other new patients are Inactive.

**Warning:** Running the seed script is destructive and replaces current operational data. Review the SQL and ensure both migrations have been applied before running it in the Supabase SQL Editor. A physical device can only be actively assigned to one patient at a time.

## Project structure

```text
src/
  app/
    devices/       Device registration and assignments
    patients/      Patient list, registration, details, and history
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
