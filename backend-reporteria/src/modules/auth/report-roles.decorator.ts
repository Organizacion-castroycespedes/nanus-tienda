const REPORT_ROLES_KEY = Symbol("REPORT_ROLES");

type ReportRolesTarget = {
  [REPORT_ROLES_KEY]?: string[];
};

const normalizeRoles = (roles: string[]) =>
  roles.map((role) => role.trim().toUpperCase()).filter(Boolean);

const setReportRoles = (target: object, roles: string[]) => {
  Object.defineProperty(target, REPORT_ROLES_KEY, {
    value: normalizeRoles(roles),
    configurable: true,
  });
};

export const getReportRoles = (target: object | null | undefined) =>
  target ? (target as ReportRolesTarget)[REPORT_ROLES_KEY] : undefined;

export const ReportRoles = (...roles: string[]): ClassDecorator & MethodDecorator => {
  const decorator = <T>(
    target: object,
    _propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ) => {
    const metadataTarget = descriptor?.value;
    setReportRoles(
      metadataTarget &&
        (typeof metadataTarget === "object" || typeof metadataTarget === "function")
        ? metadataTarget
        : target,
      roles
    );
  };

  return decorator as ClassDecorator & MethodDecorator;
};
