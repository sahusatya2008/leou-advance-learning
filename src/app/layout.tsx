import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import DevtoolsGuard from "@/components/security/DevtoolsGuard";
import TrafficBeacon from "@/components/traffic/TrafficBeacon";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Leou. — Assignments, Mock Tests & Learning",
    template: "%s · Leou.",
  },
  description:
    "Leou. is an educational platform for assignments, mock tests, coding evaluations and real assessments, with face-verified sign-in.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

/**
 * Without this the layout relied on whatever viewport the framework happened to
 * emit, which does not account for a phone's safe areas. `viewport-fit=cover`
 * lets the theme reach under the notch; `width=device-width` stops a desktop
 * width from being simulated on a small screen.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <DevtoolsGuard />
        <TrafficBeacon />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}