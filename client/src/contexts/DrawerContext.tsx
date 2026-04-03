import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface DrawerState {
  isOpen: boolean;
  type: string | null;
  entityId: string | null;
  entityName: string | null;
  metadata: Record<string, unknown> | null;
}

const DEFAULT_STATE: DrawerState = {
  isOpen: false,
  type: null,
  entityId: null,
  entityName: null,
  metadata: null,
};

interface DrawerContextValue {
  drawer: DrawerState;
  openDrawer: (type: string, entityId: string | null, entityName: string | null, metadata?: Record<string, unknown>) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue>({
  drawer: DEFAULT_STATE,
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerState>(DEFAULT_STATE);

  const openDrawer = useCallback(
    (type: string, entityId: string | null, entityName: string | null, metadata?: Record<string, unknown>) => {
      setDrawer({ isOpen: true, type, entityId, entityName, metadata: metadata || null });
    },
    [],
  );

  const closeDrawer = useCallback(() => {
    setDrawer(DEFAULT_STATE);
  }, []);

  return (
    <DrawerContext.Provider value={{ drawer, openDrawer, closeDrawer }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  return useContext(DrawerContext);
}
