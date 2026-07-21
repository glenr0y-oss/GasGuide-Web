import { createContext, useContext, useState } from 'react';

const ProContext = createContext(null);

export function ProProvider({ children }) {
  // NEXT INTEGRATION: this simulates a successful purchase. Replace with a
  // real Stripe entitlement/billing check. See CLAUDE.md "Monetization."
  const [isPro, setIsPro] = useState(false);

  function upgradeToPro() {
    setIsPro(true);
  }

  const value = { isPro, upgradeToPro };

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro() {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside <ProProvider>');
  return ctx;
}
