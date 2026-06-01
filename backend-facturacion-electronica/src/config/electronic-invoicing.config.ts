export type ElectronicInvoicingServiceConfig = {
  environment: string;
  port: number;
  serviceName: string;
  logLevel: string;
};

const parsePort = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4030;
};

export const getServiceConfig = (): ElectronicInvoicingServiceConfig => ({
  environment: process.env.NODE_ENV?.trim() || "development",
  port: parsePort(process.env.PORT),
  serviceName:
    process.env.SERVICE_NAME?.trim() || "backend-facturacion-electronica",
  logLevel: process.env.LOG_LEVEL?.trim() || "debug",
});
