"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppPreferences } from "@/lib/settings/appPreferences";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AppPreferences } from "@/types/settings";

const SA = "pages.settingsAccount" as const;

const fieldClass =
  "w-full border-border bg-background text-start text-foreground shadow-none " +
  "placeholder:text-muted-foreground focus-visible:ring-primary/30";

const labelClass = "block w-full text-start text-sm font-semibold text-foreground";

export function AccountSettingsCard() {
  const { preferences, setPreferences } = useAppPreferences();
  const [name, setName] = useState(preferences.companyName ?? "");
  const [registration, setRegistration] = useState(
    preferences.companyRegistration ?? ""
  );
  const [email, setEmail] = useState(preferences.companyEmail ?? "");
  const [phone, setPhone] = useState(preferences.companyPhone ?? "");
  const [website, setWebsite] = useState(preferences.companyWebsite ?? "");
  const [address, setAddress] = useState(preferences.companyAddress ?? "");

  useEffect(() => {
    setName(preferences.companyName ?? "");
    setRegistration(preferences.companyRegistration ?? "");
    setEmail(preferences.companyEmail ?? "");
    setPhone(preferences.companyPhone ?? "");
    setWebsite(preferences.companyWebsite ?? "");
    setAddress(preferences.companyAddress ?? "");
  }, [
    preferences.companyName,
    preferences.companyRegistration,
    preferences.companyEmail,
    preferences.companyPhone,
    preferences.companyWebsite,
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
          <Textarea
            id="settings-company-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() =>
              persist({ companyAddress: address.trim() || undefined })
            }
            placeholder={t(`${SA}.addressPlaceholder`)}
            rows={3}
            className={cn(
              fieldClass,
              "min-h-[88px] resize-y"
            )}
            autoComplete="street-address"
            dir="rtl"
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
            htmlFor="settings-company-email"
            className={labelClass}
          >
            {t(`${SA}.emailLabel`)}
          </Label>
          <Input
            id="settings-company-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => persist({ companyEmail: email.trim() || undefined })}
            placeholder={t(`${SA}.emailPlaceholder`)}
            autoComplete="email"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
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
        <div className="space-y-1.5">
          <Label
            htmlFor="settings-company-website"
            className={labelClass}
          >
            {t(`${SA}.websiteLabel`)}
          </Label>
          <Input
            id="settings-company-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onBlur={() => persist({ companyWebsite: website.trim() || undefined })}
            placeholder={t(`${SA}.websitePlaceholder`)}
            autoComplete="url"
            dir="rtl"
            className={cn(fieldClass, "h-10")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
