export const buildTerminalPeripheralsPath = (
  tenantSlug: string,
  terminalId: string
) => {
  const normalizedTenant = tenantSlug.trim();
  const normalizedTerminalId = terminalId.trim();
  const query = normalizedTerminalId
    ? `?terminalId=${encodeURIComponent(normalizedTerminalId)}`
    : "";

  return `/${normalizedTenant}/admin/peripherals${query}`;
};
