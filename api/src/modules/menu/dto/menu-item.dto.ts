export type CreateMenuItemDto = {
  tenantId: string;
  key: string;
  module: string;
  label: string;
  route: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  visible?: boolean;
  belowMainMenu?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateMenuItemDto = {
  key?: string;
  module?: string;
  label?: string;
  route?: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  visible?: boolean;
  belowMainMenu?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateMenuItemStatusDto = {
  visible: boolean;
};
