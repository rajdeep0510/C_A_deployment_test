"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Settings = {
  boardTheme: string;
  soundEnabled: boolean;
  engineDepth: number;
  multiPv: number;
  maxWorkers: number;
  hashSize: number;
  liteMode: boolean;
  useRecommended: boolean;
};

type SettingsContextType = Settings & {
  setBoardTheme: (theme: string) => void;
  setSoundEnabled: (val: boolean) => void;
  setEngineDepth: (val: number) => void;
  setMultiPv: (val: number) => void;
  setMaxWorkers: (val: number) => void;
  setHashSize: (val: number) => void;
  setLiteMode: (val: boolean) => void;
  setUseRecommended: (val: boolean) => void;
};

// Balanced defaults for the WASM analysis engine — two-line search (enough
// for Brilliant/Great classification and the alternative-move arrows to
// fire), plus enough depth/hash to be accurate without stalling low-end
// devices.
export const RECOMMENDED_ENGINE_SETTINGS = {
  engineDepth: 14,
  multiPv: 2,
  maxWorkers: 2,
  hashSize: 16,
} as const;

const defaults: Settings = {
  boardTheme: "classic",
  soundEnabled: true,
  ...RECOMMENDED_ENGINE_SETTINGS,
  liteMode: false,
  useRecommended: true,
};

function load(): Settings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem("chessAdvisorSettings");
    if (!raw) return defaults;
    const merged = { ...defaults, ...JSON.parse(raw) };
    // Recommended mode is authoritative over whatever engine values happen to
    // be stored (covers stale localStorage from before this flag existed).
    return merged.useRecommended ? { ...merged, ...RECOMMENDED_ENGINE_SETTINGS } : merged;
  } catch {
    return defaults;
  }
}

function save(settings: Settings) {
  localStorage.setItem("chessAdvisorSettings", JSON.stringify(settings));
}

const SettingsContext = createContext<SettingsContextType>({
  ...defaults,
  setBoardTheme: () => {},
  setSoundEnabled: () => {},
  setEngineDepth: () => {},
  setMultiPv: () => {},
  setMaxWorkers: () => {},
  setHashSize: () => {},
  setLiteMode: () => {},
  setUseRecommended: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(settings);
  }, [settings, hydrated]);

  const patch = (partial: Partial<Settings>) =>
    setSettings((prev) => ({ ...prev, ...partial }));

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setBoardTheme: (boardTheme) => patch({ boardTheme }),
        setSoundEnabled: (soundEnabled) => patch({ soundEnabled }),
        setEngineDepth: (engineDepth) => patch({ engineDepth }),
        setMultiPv: (multiPv) => patch({ multiPv }),
        setMaxWorkers: (maxWorkers) => patch({ maxWorkers }),
        setHashSize: (hashSize) => patch({ hashSize }),
        setLiteMode: (liteMode) => patch({ liteMode }),
        setUseRecommended: (useRecommended) =>
          patch(useRecommended ? { useRecommended, ...RECOMMENDED_ENGINE_SETTINGS } : { useRecommended }),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
