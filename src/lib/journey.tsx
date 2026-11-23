import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { Itinerary } from "@/lib/amigo";

export type ActiveJourney = {
  itinerary: Itinerary;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; address: string };
};

type JourneyContextValue = {
  journey: ActiveJourney | null;
  setJourney: (journey: ActiveJourney | null) => void;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [journey, setJourney] = useState<ActiveJourney | null>(null);
  const value = useMemo(() => ({ journey, setJourney }), [journey]);
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const value = useContext(JourneyContext);
  if (!value) throw new Error("useJourney doit être utilisé dans JourneyProvider");
  return value;
}
