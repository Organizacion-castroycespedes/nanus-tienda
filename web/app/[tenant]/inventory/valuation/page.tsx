import { InventoryValuationShell } from "../../../../modules/inventory/components/InventoryValuationShell";

const InventoryValuationPage = ({ params }: { params: { tenant: string } }) => (
  <InventoryValuationShell tenantSegment={params.tenant} />
);

export default InventoryValuationPage;
