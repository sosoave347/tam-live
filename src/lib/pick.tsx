import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { SavedPlace } from "@/lib/places";

export type PickRole = "origin" | "destination";

type PickValue = {
  role: PickRole | null;
  origin: SavedPlace | null;
  destination: SavedPlace | null;
  back: "/trajet" | "/amigo";
  start: (role: PickRole, back?: "/trajet" | "/amigo") => void;
  cancel: () => void;
  confirm: (place: SavedPlace) => void;
  clear: (role: PickRole) => void;
};

const PickContext = createContext<PickValue | null>(null);

export function PickProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PickRole | null>(null);
  const [back, setBack] = useState<"/trajet" | "/amigo">("/trajet");
  const [origin, setOrigin] = useState<SavedPlace | null>(null);
  const [destination, setDestination] = useState<SavedPlace | null>(null);

  const value = useMemo<PickValue>(
    () => ({
      role,
      back,
      origin,
      destination,
      start: (next, returnTo = "/trajet") => {
        setBack(returnTo);
        setRole(next);
      },
      cancel: () => setRole(null),
      confirm: (place) => {
        if (role === "origin") setOrigin(place);
        if (role === "destination") setDestination(place);
        setRole(null);
      },
      clear: (target) => {
        if (target === "origin") setOrigin(null);
        if (target === "destination") setDestination(null);
      },
    }),
    [role, back, origin, destination],
  );

  return <PickContext.Provider value={value}>{children}</PickContext.Provider>;
}

export function usePick() {
  const value = useContext(PickContext);
  if (!value) throw new Error("usePick doit être utilisé dans PickProvider");
  return value;
}
