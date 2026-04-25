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
  /** Tells built-in translation not to mark the app — see layout `translate="no"`. */
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const supabasePublicJson =
    sbUrl && sbKey
      ? JSON.stringify({ url: sbUrl, key: sbKey })
      : "";

  return (
    <html
      lang="he"
      dir="rtl"
      translate="no"
      className="notranslate"
      suppressHydrationWarning
    >
      <body
        className={`notranslate ${notoSansHebrew.variable} ${notoSansHebrew.className} antialiased`}
      >
        {supabasePublicJson ? (
          <Script
            id="plate-supabase-public-env"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `try{window.__PLATE_PUBLIC_SUPABASE__=${supabasePublicJson};}catch(e){}`,
            }}
          />
        ) : null}
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
