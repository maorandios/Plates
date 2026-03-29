"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppPreferences } from "@/lib/settings/appPreferences";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { AppPreferences } from "@/types/settings";

export function AccountSettingsCard() {
  const { preferences, setPreferences } = useAppPreferences();
  const [name, setName] = useState(preferences.companyName ?? "");
  const [email, setEmail] = useState(preferences.companyEmail ?? "");
  const [phone, setPhone] = useState(preferences.companyPhone ?? "");
  const [website, setWebsite] = useState(preferences.companyWebsite ?? "");
  const [address, setAddress] = useState(preferences.companyAddress ?? "");

  useEffect(() => {
    setName(preferences.companyName ?? "");
    setEmail(preferences.companyEmail ?? "");
    setPhone(preferences.companyPhone ?? "");
    setWebsite(preferences.companyWebsite ?? "");
    setAddress(preferences.companyAddress ?? "");
  }, [
    preferences.companyName,
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
    <Card className="border border-border shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Company & account</CardTitle>
        <CardDescription>
          Used as defaults on quotation PDFs and the finalize step. Values here override
          environment defaults when set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="settings-company-name">Company name</Label>
          <Input
            id="settings-company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => persist({ companyName: name.trim() || undefined })}
            placeholder="e.g. Acme Steel Fabrication"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-company-address">Company address</Label>
          <Textarea
            id="settings-company-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() =>
              persist({ companyAddress: address.trim() || undefined })
            }
            placeholder="Street, city, postal code, country"
            rows={3}
            className="min-h-[80px] resize-y"
            autoComplete="street-address"
          />
          <p className="text-[11px] text-muted-foreground">
            Multiple lines are supported. Shown on quotation PDFs when exported.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-company-email">Email</Label>
          <Input
            id="settings-company-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => persist({ companyEmail: email.trim() || undefined })}
            placeholder="quotes@company.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-company-phone">Phone</Label>
          <Input
            id="settings-company-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => persist({ companyPhone: phone.trim() || undefined })}
            placeholder="+1 …"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-company-website">Website</Label>
          <Input
            id="settings-company-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onBlur={() => persist({ companyWebsite: website.trim() || undefined })}
            placeholder="https://…"
            autoComplete="url"
          />
        </div>
      </CardContent>
    </Card>
  );
}
