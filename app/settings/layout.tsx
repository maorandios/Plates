import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>;
}
