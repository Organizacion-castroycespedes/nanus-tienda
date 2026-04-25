export type AccessLevel = "READ" | "WRITE";

export class Permission {
  constructor(
    public readonly menuItemId: string,
    public readonly key: string,
    public readonly module: string,
    public readonly route: string,
    public readonly label: string,
    public readonly icon: string | null,
    public readonly parentId: string | null,
    public readonly sortOrder: number,
    public readonly visible: boolean,
    public readonly metadata: Record<string, unknown>,
    public readonly accessLevel: AccessLevel,
    public readonly actions: Record<string, boolean>
  ) {}
}
