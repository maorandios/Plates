"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getAppPreferences } from "@/lib/settings/appPreferences";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AppPreferences } from "@/types/settings";

const SA = "pages.settingsAccount" as const;

const fieldClass =
  "w-full border-border bg-background text-start text-foreground shadow-none " +
  "placeholder:text-muted-foreground";

const labelClass = "block w-full text-start text-sm font-semibold text-foreground";

export function AccountSettingsCard() {
  const { preferences, setPreferences } = useAppPreferences();
  const [signInEmail, setSignInEmail] = useState<string | null>(null);
  const seededCompanyEmail = useRef(false);

  const [name, setName] = useState(preferences.companyName ?? "");
  const [registration, setRegistration] = useState(
    preferences.companyRegistration ?? ""
  );
  const [phone, setPhone] = useState(preferences.companyPhone ?? "");
  const [address, setAddress] = useState(preferences.companyAddress ?? "");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignInEmail(null);
      return;
    }
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setSignInEmail(user?.email ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignInEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /** Keep letterhead/PDF default email aligned with sign-in when nothing was set yet. */
  useEffect(() => {
    if (!signInEmail || seededCompanyEmail.current) return;
    const cur = getAppPreferences();
    if (cur.companyEmail?.trim()) {
      seededCompanyEmail.current = true;
      return;
    }
    seededCompanyEmail.current = true;
    const base = getAppPreferences();
    setPreferences({ ...base, companyEmail: signInEmail });
  }, [signInEmail, setPreferences]);

  useEffect(() => {
    setName(preferences.companyName ?? "");
    setRegistration(preferences.companyRegistration ?? "");
    setPhone(preferences.companyPhone ?? "");
    setAddress(preferences.companyAddress ?? "");
  }, [
    preferences.companyName,
    preferences.companyRegistration,
    preferences.companyPhone,
    preferences.companyAddress,
  ]);

  const persist = useCallback(
    (patch: Partial<AppPreferences>) => {
      const base = getAppPreferences();
      setPreferences({ ...base, ...patch });
    },
    [setPreferences]
  );

  return (
    <Card
      className="border border-border bg-card shadow-sm"
      dir="rtl"
    >
      <CardContent className="space-y-5 p-6 sm:p-8">
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-company-name"
            className={labelClass}
          >
            {t(`${SA}.companyNameLabel`)}
          </Label>
          <Input
            id="settings-company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => persist({ companyName: name.trim() || undefined })}
            placeholder={t(`${SA}.companyNamePlaceholder`)}
            autoComplete="organization"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-company-registration"
            className={labelClass}
          >
            {t(`${SA}.companyRegistrationLabel`)}
          </Label>
          <Input
            id="settings-company-registration"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            onBlur={() =>
              persist({ companyRegistration: registration.trim() || undefined })
            }
            placeholder={t(`${SA}.companyRegistrationPlaceholder`)}
            inputMode="numeric"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-company-address"
            className={labelClass}
          >
            {t(`${SA}.addressLabel`)}
          </Label>
          <Input
            id="settings-company-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() =>
              persist({ companyAddress: address.trim() || undefined })
            }
            placeholder={t(`${SA}.addressPlaceholder`)}
            autoComplete="street-address"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
          <p
            className="text-pretty text-[11px] leading-relaxed text-muted-foreground"
            dir="rtl"
          >
            {t(`${SA}.addressHint`)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-account-signin-email"
            className={labelClass}
          >
            {t(`${SA}.accountEmailLabel`)}
          </Label>
          <Input
            id="settings-account-signin-email"
            type="text"
            readOnly
            inputMode="email"
            aria-readonly="true"
            value={signInEmail ?? ""}
            placeholder={
              !isSupabaseConfigured()
                ? t(`${SA}.accountEmailNotConnected`)
                : signInEmail
                  ? ""
                  : "—"
            }
            autoComplete="off"
            dir="rtl"
            className={cn(
              fieldClass,
              "h-10 cursor-default border-dashed bg-muted/40 text-muted-foreground",
              !signInEmail && "text-muted-foreground/80"
            )}
          />
          <p
            className="text-pretty text-[11px] leading-relaxed text-muted-foreground"
            dir="rtl"
          >
            {t(`${SA}.accountEmailHint`)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-company-phone"
            className={labelClass}
          >
            {t(`${SA}.phoneLabel`)}
          </Label>
          <Input
            id="settings-company-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => persist({ companyPhone: phone.trim() || undefined })}
            placeholder={t(`${SA}.phonePlaceholder`)}
            autoComplete="tel"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
