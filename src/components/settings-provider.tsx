"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSettings, type Settings } from "@/lib/settings";

type SettingsContextType = {
  settings: Settings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  const currency = context.settings?.default_currency || "INR";

  // Stable identity per currency so consumers can safely use it as a
  // useMemo/useCallback dependency without defeating memoization.
  const formatCurrency = useCallback(
    (amount: number, withPaise = false) =>
      new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: withPaise ? 2 : 0,
      }).format(amount),
    [currency],
  );

  return { ...context, formatCurrency };
}
