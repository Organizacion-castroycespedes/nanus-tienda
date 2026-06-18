import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coins,
  FileText,
  LayoutGrid,
  Percent,
  PackageOpen,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type QuickAction = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: (tenant: string) => string;
  accent: "primary" | "emerald" | "amber" | "slate";
};

export type HomeModule = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: (tenant: string) => string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "nueva-venta",
    title: "Nueva venta",
    description: "Registra una venta en el punto de venta.",
    icon: ShoppingCart,
    href: (t) => `/${t}/pos`,
    accent: "primary",
  },
  {
    key: "caja",
    title: "Abrir / ver caja",
    description: "Controla la apertura y el cierre de caja.",
    icon: Wallet,
    href: (t) => `/${t}/finance`,
    accent: "emerald",
  },
  {
    key: "crear-pedido",
    title: "Crear pedido",
    description: "Genera un nuevo pedido para un cliente.",
    icon: ClipboardList,
    href: (t) => `/${t}/orders`,
    accent: "slate",
  },
  {
    key: "registrar-cliente",
    title: "Registrar cliente",
    description: "Agrega un cliente a tu base de datos.",
    icon: UserPlus,
    href: (t) => `/${t}/customers`,
    accent: "slate",
  },
  {
    key: "ver-inventario",
    title: "Ver inventario",
    description: "Consulta existencias y stock disponible.",
    icon: Boxes,
    href: (t) => `/${t}/inventory`,
    accent: "slate",
  },
  {
    key: "recibir-compra",
    title: "Recibir compra",
    description: "Registra la recepción de mercadería.",
    icon: PackageOpen,
    href: (t) => `/${t}/purchases`,
    accent: "slate",
  },
  {
    key: "ver-reportes",
    title: "Ver reportes",
    description: "Revisa el desempeño del negocio.",
    icon: BarChart3,
    href: (t) => `/${t}/reporteria`,
    accent: "slate",
  },
];

export const HOME_MODULES: HomeModule[] = [
  {
    key: "pos",
    title: "POS",
    description: "Punto de venta para cobros rápidos.",
    icon: Store,
    href: (t) => `/${t}/pos`,
  },
  {
    key: "caja",
    title: "Caja",
    description: "Apertura, cierre y movimientos.",
    icon: Wallet,
    href: (t) => `/${t}/finance`,
  },
  {
    key: "pedidos",
    title: "Pedidos",
    description: "Gestión de pedidos de clientes.",
    icon: ClipboardList,
    href: (t) => `/${t}/orders`,
  },
  {
    key: "inventario",
    title: "Inventario",
    description: "Productos, stock y existencias.",
    icon: Boxes,
    href: (t) => `/${t}/inventory`,
  },
  {
    key: "compras",
    title: "Compras",
    description: "Órdenes y recepción de mercadería.",
    icon: Truck,
    href: (t) => `/${t}/purchases`,
  },
  {
    key: "clientes",
    title: "Clientes",
    description: "Base de datos de clientes.",
    icon: Users,
    href: (t) => `/${t}/customers`,
  },
  {
    key: "proveedores",
    title: "Proveedores",
    description: "Directorio de proveedores.",
    icon: Truck,
    href: (t) => `/${t}/suppliers`,
  },
  {
    key: "promociones",
    title: "Promociones",
    description: "Descuentos y ofertas activas.",
    icon: Percent,
    href: (t) => `/${t}/inventory/promotions`,
  },
  {
    key: "impuestos",
    title: "Impuestos",
    description: "Tasas e impuestos aplicables.",
    icon: Receipt,
    href: (t) => `/${t}/inventory/taxes`,
  },
  {
    key: "reportes",
    title: "Reportes",
    description: "Indicadores y resúmenes.",
    icon: FileText,
    href: (t) => `/${t}/reporteria`,
  },
  {
    key: "configuracion",
    title: "Configuración",
    description: "Ajustes del negocio y sistema.",
    icon: Settings,
    href: (t) => `/${t}/configuracion`,
  },
];

export const MODULE_FALLBACK_ICON: LucideIcon = LayoutGrid;
export const COIN_ICON: LucideIcon = Coins;
