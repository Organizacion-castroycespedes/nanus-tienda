export type TenantConfig = {
  colors: {
    primary: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  font: string;
  logo?: string;
  spacing?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
};

export type Tenant = {
  id: string;
  slug: string;
  nombre: string;
  config: TenantConfig;
};
