import DisputeDetailView from "@/components/DisputeDetailView";

export default function DisputeDetailPage({ params }: { params: { id: string } }) {
  return <DisputeDetailView disputeId={params.id} />;
}

export const dynamic = "force-dynamic";
