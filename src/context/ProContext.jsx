import { createContext, useContext, useState } from 'react';

const ProContext = createContext(null);

export function ProProvider({ children }) {
  // NEXT INTEGRATION: togglePro is a dev-only toggle for previewing the
  // Pro theme instantly, in both directions. Real billing replaces this
  // entirely with a Stripe entitlement/billing check that only ever turns
  // isPro on. See CLAUDE.md "Monetization."
  const [isPro, setIsPro] = useState(false);

  function togglePro() {
    setIsPro((prev) => !prev);
  }

  const value = { isPro, togglePro };

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro() {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used inside <ProProvider>');
  return ctx;
}
