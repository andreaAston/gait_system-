import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gait Monitoring Dashboard",
  description: "Remote gait analysis and rehabilitation monitoring",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
