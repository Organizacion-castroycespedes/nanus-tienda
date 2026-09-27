import dynamic from "next/dynamic";

const InventoryValuationShell = dynamic(
  () =>
    import(
      "../../../../modules/inventory/components/InventoryValuationShell"
    ).then((m) => m.InventoryValuationShell),
  {
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center p-8 text-slate-500">
        Cargando valoración de inventario...
      </div>
    ),
  }
);

const InventoryValuationPage = ({ params }: { params: { tenant: string } }) => (
  <InventoryValuationShell tenantSegment={params.tenant} />
);

export default InventoryValuationPage;
