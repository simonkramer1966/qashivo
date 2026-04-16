import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  onComplete: () => void;
  xeroConnected: boolean;
}

export default function ConnectAccounting({ onComplete, xeroConnected }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-advance when Xero is already connected
  useEffect(() => {
    if (xeroConnected) {
      onComplete();
    }
  }, [xeroConnected, onComplete]);

  // Poll for connection status after OAuth redirect
  const { data: status } = useQuery<{ onboardingStep: number; xeroConnected: boolean }>({
    queryKey: ["/api/onboarding/guided-status"],
    refetchInterval: xeroConnected ? false : 3000,
  });

  useEffect(() => {
    if (status?.xeroConnected) {
      onComplete();
    }
  }, [status?.xeroConnected, onComplete]);

  const handleConnectXero = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await apiRequest("GET", "/api/integrations/xero/connect");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error("[Onboarding] No authUrl in response:", data);
        setError("Failed to get Xero authorisation URL. Please try again.");
        setConnecting(false);
      }
    } catch (err) {
      console.error("[Onboarding] Xero connect error:", err);
      setError("Failed to connect to Xero. Please try again.");
      setConnecting(false);
    }
  };

  const providers = [
    {
      name: "Xero",
      logo: "/images/marketing/xero-logo.png",
      available: true,
      connected: xeroConnected || status?.xeroConnected,
    },
    { name: "QuickBooks", logo: "/images/marketing/quickbooks-logo.png", available: false },
    { name: "Sage", logo: "/images/marketing/sage-logo.png", available: false },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">Connect your accounting</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          We'll import your invoices and customers so Charlie can get to work.
        </p>
      </div>

      <div className="space-y-3">
        {providers.map((p) => {
          const isConnecting = connecting && p.name === "Xero";
          return (
            <button
              key={p.name}
              disabled={!p.available || !!p.connected || isConnecting}
              onClick={p.available && !p.connected ? handleConnectXero : undefined}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                p.connected
                  ? "border-green-200 bg-green-50"
                  : p.available
                  ? "border-[var(--q-border)] bg-[var(--q-bg-surface)] hover:border-[var(--q-accent)] cursor-pointer"
                  : "border-[var(--q-border)] bg-[var(--q-bg-page)] opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="w-10 h-10 rounded bg-[var(--q-bg-page)] flex items-center justify-center shrink-0">
                <img src={p.logo} alt={p.name} className="w-6 h-6 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[var(--q-text-primary)]">{p.name}</div>
                {!p.available && (
                  <div className="text-xs text-[var(--q-text-tertiary)]">Coming soon</div>
                )}
              </div>
              {p.connected ? (
                <Check className="w-5 h-5 text-green-600 shrink-0" />
              ) : isConnecting ? (
                <Loader2 className="w-4 h-4 text-[var(--q-text-tertiary)] shrink-0 animate-spin" />
              ) : p.available ? (
                <ExternalLink className="w-4 h-4 text-[var(--q-text-tertiary)] shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
