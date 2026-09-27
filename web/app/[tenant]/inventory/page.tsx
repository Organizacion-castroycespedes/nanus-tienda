import dynamic from "next/dynamic";

const InventoryBiDashboard = dynamic(
  () =>
    import("../../../modules/inventory/components/InventoryBiDashboard").then(
      (m) => m.InventoryBiDashboard
    ),
  {
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center p-8 text-slate-500">
        Cargando inventario BI...
      </div>
    ),
  }
);

const InventoryPage = () => {
  return <InventoryBiDashboard />;
};

export default InventoryPage;
