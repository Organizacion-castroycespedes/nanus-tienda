export type AccessLevel = "READ" | "WRITE";

export type MenuItem = {
  id: string;
  key: string;
  module: string;
  label: string;
  route: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  visible: boolean;
  belowMainMenu: boolean;
  metadata: Record<string, unknown>;
  accessLevel: AccessLevel;
  inherited?: boolean;
  children?: MenuItem[];
};

export type MenuResponse = {
  items: MenuItem[];
};

export type PermissionSummary = {
  key: string;
  module: string;
  route: string;
  accessLevel: AccessLevel;
  actions: Record<string, boolean>;
};

export type PermissionsResponse = {
  items: PermissionSummary[];
};
