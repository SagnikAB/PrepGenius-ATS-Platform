import "./globals.css";
import { AppShell } from "../components/app-shell";
import { ThemeProvider } from "../components/theme-provider";

export const metadata = { title: "PrepGenius", description: "AI-powered applicant tracking" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
