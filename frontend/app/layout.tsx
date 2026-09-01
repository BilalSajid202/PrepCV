import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { FeatureProvider } from "@/lib/feature-context";

export const metadata: Metadata = {
  title: "PrepCV | AI-Powered Career Platform",
  description: "Build your resume. Prepare for interviews. Get hired.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <FeatureProvider>{children}</FeatureProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

