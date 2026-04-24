import type { Metadata } from "next";
import { Noto_Sans_Hebrew } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/shared/AppShell";
import { OnboardingRouteGuard } from "@/components/shared/OnboardingRouteGuard";
import { OrgBootstrapProvider } from "@/components/providers/OrgBootstrapProvider";
import { SupabaseSyncProvider } from "@/components/providers/SupabaseSyncProvider";
import { EntityTableHydrationProvider } from "@/components/providers/EntityTableHydrationProvider";
import { LoadingBadgeProvider } from "@/components/shared/LoadingBadgeProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PLATE_THEME_STORAGE_KEY } from "@/lib/theme/plateTheme";
import messages from "@/messages/he.json";

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-hebrew",
  display: "swap",
});

export const metadata: Metadata = {
  title: messages.meta.title,
  description: messages.meta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body
        className={`${notoSansHebrew.variable} ${notoSansHebrew.className} antialiased`}
      >
        <Script
          id="plate-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(PLATE_THEME_STORAGE_KEY)};var v=localStorage.getItem(k);if(v!=="dark")document.documentElement.classList.add("light");}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <LoadingBadgeProvider>
            <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background">
              <OrgBootstrapProvider>
                <OnboardingRouteGuard>
                  <EntityTableHydrationProvider>
                    <SupabaseSyncProvider>
                      <AppShell>{children}</AppShell>
                    </SupabaseSyncProvider>
                  </EntityTableHydrationProvider>
                </OnboardingRouteGuard>
              </OrgBootstrapProvider>
            </div>
          </LoadingBadgeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
