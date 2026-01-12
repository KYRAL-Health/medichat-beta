import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediChat Assistant (Beta)",
  description: "AI-powered medical assistant for patients and physicians",
};

function coerceTheme(value: string | undefined): "light" | "dark" | null {
  if (value === "dark") return "dark";
  if (value === "light") return "light";
  return null;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("medichat_theme")?.value;
  const theme = coerceTheme(themeCookie);

  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="medichat-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var match = document.cookie.match(/(?:^|; )medichat_theme=([^;]+)/);
                var theme = match ? decodeURIComponent(match[1]) : null;
                var isDark = theme === "dark"
                  ? true
                  : theme === "light"
                    ? false
                    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
                var root = document.documentElement;
                root.classList.toggle("dark", !!isDark);
                root.style.colorScheme = isDark ? "dark" : "light";
              } catch (e) {}
            })();
          `}
        </Script>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
