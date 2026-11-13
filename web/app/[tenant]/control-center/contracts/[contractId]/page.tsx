"use client";

import { useParams } from "next/navigation";
import { ContractDetailView } from "../../../../../domains/control-center/components/ContractDetailView";

export default function ControlCenterContractDetailPage() {
  const params = useParams<{ contractId: string }>();
  const contractId = Array.isArray(params?.contractId) ? params.contractId[0] : params?.contractId;
  return contractId ? <ContractDetailView contractId={contractId} /> : null;
}
