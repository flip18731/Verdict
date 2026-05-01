"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { RPC_URL } from "@/lib/config";

// If the configured RPC is unreachable we want a loud, dismissable warning
// so the operator doesn't blame the program when the validator is just down.
export function NetworkBanner() {
  const { connection } = useConnection();
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await connection.getVersion();
        if (!cancelled) setReachable(true);
      } catch {
        if (!cancelled) setReachable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  if (reachable !== false) return null;
  return (
    <div className="bg-red-700 text-cream-50 text-sm">
      <div className="mx-auto max-w-5xl px-6 py-2">
        Cannot reach RPC at <span className="font-mono">{RPC_URL}</span>. Run{" "}
        <span className="font-mono">solana-test-validator --reset</span> and refresh.
      </div>
    </div>
  );
}
