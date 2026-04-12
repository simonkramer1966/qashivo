import { SignIn } from "@clerk/clerk-react";
import { useSearch } from "wouter";

export default function PartnerLoginPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const type = params.get("type") || "partner";
  const isFunder = type === "funder";

  return (
    <div className="min-h-screen bg-[var(--q-bg-page)] flex flex-col items-center pt-[20vh]">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--q-text-primary)]">
            Qashivo{" "}
            <span
              className={
                isFunder
                  ? "text-[var(--q-attention-text)]"
                  : "text-[var(--q-money-in-text)]"
              }
            >
              {isFunder ? "Finance" : "Partner"}
            </span>
          </h1>
          <p className="text-[var(--q-text-tertiary)] text-sm">
            Partner portal login
          </p>
        </div>

        {/* Clerk sign-in widget */}
        <SignIn
          routing="path"
          path="/partner/login"
          forceRedirectUrl="/partner/dashboard"
          appearance={{
            variables: {
              colorPrimary: "var(--q-accent)",
              colorText: "var(--q-text-primary)",
              colorTextSecondary: "var(--q-text-secondary)",
              colorBackground: "var(--q-bg-surface)",
              colorInputBackground: "var(--q-bg-input)",
              borderRadius: "var(--q-radius-md)",
              fontFamily: "Inter, sans-serif",
            },
          }}
        />

        {/* Footer link */}
        <p className="text-center text-[13px] text-[var(--q-text-tertiary)]">
          Not a partner?{" "}
          <a href="/login" className="underline hover:text-[var(--q-text-secondary)]">
            Sign in to Qashivo &rarr;
          </a>
        </p>
      </div>
    </div>
  );
}
