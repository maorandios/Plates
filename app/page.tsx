import Link from "next/link";
import { Calculator, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { t } from "@/lib/i18n";

const primaryCtaClass =
  "group flex min-h-[14rem] w-full flex-col items-center justify-center gap-4 p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[16rem] sm:p-10";

export default function DashboardPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageContainer
        embedded
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6 lg:gap-10 lg:p-8"
      >
        <h1 className="shrink-0 text-center text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t("dashboard.welcomeTitle")}
        </h1>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <Card className="overflow-hidden border border-border bg-card/80 p-0 shadow-none">
            <Link
              href="/plate-project"
              className={`${primaryCtaClass} border-0 bg-white/[0.04] hover:bg-white/[0.06]`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:h-16 sm:w-16">
                <FolderKanban
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <span className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                {t("dashboard.cardNewProject")}
              </span>
            </Link>
          </Card>

          <Card className="overflow-hidden border border-border bg-card/80 p-0 shadow-none">
            <Link
              href="/quick-quote"
              className={`${primaryCtaClass} border-0 bg-white/[0.04] hover:bg-white/[0.06]`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 sm:h-16 sm:w-16">
                <Calculator
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <span className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                {t("dashboard.cardNewQuote")}
              </span>
            </Link>
          </Card>
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          aria-label={t("dashboard.browseNavAria")}
        >
          <Link
            href="/projects"
            className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("projects.title")}
          </Link>
          <Link
            href="/quotes"
            className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("quotes.title")}
          </Link>
        </nav>
      </PageContainer>
    </div>
  );
}
