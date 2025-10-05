import { createContext, useContext, useState, ReactNode } from 'react';

interface SplashContextType {
  showSplash: boolean;
  setShowSplash: (show: boolean) => void;
  triggerSplash: () => void;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export function SplashProvider({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);

  const triggerSplash = () => {
    setShowSplash(true);
  };

  return (
    <SplashContext.Provider value={{ showSplash, setShowSplash, triggerSplash }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash() {
  const context = useContext(SplashContext);
  if (!context) {
    throw new Error('useSplash must be used within a SplashProvider');
  }
  return context;
}
