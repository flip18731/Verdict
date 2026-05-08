import { PublicKey } from "@solana/web3.js";
import DisputeDetailLive from "@/components/DisputeDetailLive";
import DisputeDetailView from "@/components/DisputeDetailView";

export default function DisputeDetailPage({ params }: { params: { id: string } }) {
  // Parse-only validation here. We pass the *string* into the client component
  // and let it re-derive the PublicKey — class instances don't survive the
  // server→client serialization boundary in Next.js App Router.
  let isPubkey = false;
  try {
    new PublicKey(params.id);
    isPubkey = true;
  } catch {
    isPubkey = false;
  }
  return isPubkey ? (
    <DisputeDetailLive disputePkStr={params.id} />
  ) : (
    <DisputeDetailView disputeId={params.id} />
  );
}

export const dynamic = "force-dynamic";
