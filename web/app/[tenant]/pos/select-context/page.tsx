import { PosContextSelector } from "../../../../domains/pos/components/PosContextSelector";

const PosSelectContextPage = async ({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) => {
  const { tenant } = await params;

  return <PosContextSelector tenantSlug={tenant} />;
};

export default PosSelectContextPage;
