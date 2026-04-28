import { PosContextSelector } from "../../../../domains/pos/components/PosContextSelector";

const PosSelectContextPage = ({
  params,
}: {
  params: { tenant: string };
}) => {
  return <PosContextSelector tenantSlug={params.tenant} />;
};

export default PosSelectContextPage;
