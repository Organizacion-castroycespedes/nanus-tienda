export type MenuItemDto = {
  id: string;
  key: string;
  module: string;
  route: string;
  label: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  visible: boolean;
  belowMainMenu: boolean;
  metadata: Record<string, unknown>;
  accessLevel: "READ" | "WRITE";
  inherited?: boolean;
  children?: MenuItemDto[];
};

export class MenuItem {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly module: string,
    public readonly route: string,
    public readonly label: string,
    public readonly icon: string | null,
    public readonly parentId: string | null,
    public readonly sortOrder: number,
    public readonly visible: boolean,
    public readonly belowMainMenu: boolean,
    public readonly metadata: Record<string, unknown>,
    public readonly accessLevel: "READ" | "WRITE",
    public readonly inherited: boolean = false
  ) {}

  toDto(): MenuItemDto {
    return {
      id: this.id,
      key: this.key,
      module: this.module,
      route: this.route,
      label: this.label,
      icon: this.icon,
      parentId: this.parentId,
      sortOrder: this.sortOrder,
      visible: this.visible,
      belowMainMenu: this.belowMainMenu,
      metadata: this.metadata,
      accessLevel: this.accessLevel,
      inherited: this.inherited,
    };
  }
}
