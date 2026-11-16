import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const font = localFont({ src: "./fonts/jakarta.woff2", variable: "--font-jakarta", display: "swap", weight: "200 800" });

export const metadata: Metadata = {
  title: { default: "NeonLabz CRM", template: "%s | NeonLabz CRM" },
  description: "NeonLabz customer, project and finance workspace.",
};

export const viewport: Viewport = { themeColor: "#7a2bf0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
