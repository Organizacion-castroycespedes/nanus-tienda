export type MenuItemRecord = {
  id: string;
  tenant_id: string;
  key: string;
  module: string;
  label: string;
  route: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  visible: boolean;
  below_main_menu: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RoleMenuPermissionRecord = {
  menu_item_id: string;
  access_level: "READ" | "WRITE";
  actions: Record<string, boolean>;
  key: string;
  module: string;
  label: string;
  route: string;
};
