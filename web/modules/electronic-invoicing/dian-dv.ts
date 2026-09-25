/**
 * Official DIAN Colombia Modulo 11 Verification Digit (DV) calculation.
 * Applies to NIT (31), Cédula de Ciudadanía (13), Cédula de Extranjería (22),
 * NUIP (91), PEP (48), PPT (47), NIT de otro país (50), Pasaporte (41), etc.
 */
export const calculateDianDv = (docNumber: string): string => {
  const sanitized = (docNumber || "").toString().replace(/\D/g, "");
  if (!sanitized) return "";

  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;

  for (let i = 0; i < sanitized.length && i < weights.length; i++) {
    const digit = parseInt(sanitized.charAt(sanitized.length - 1 - i), 10);
    sum += digit * weights[i];
  }

  const remainder = sum % 11;
  if (remainder === 0) return "0";
  if (remainder === 1) return "1";
  return String(11 - remainder);
};

export const documentTypesSupportingDv = new Set([
  "31", // NIT (Número de Identificación Tributaria)
  "13", // Cédula de ciudadanía
  "22", // Cédula de extranjería
  "91", // NUIP
  "50", // NIT de otro país
  "48", // PEP (Permiso Especial de Permanencia)
  "47", // PPT (Permiso por Protección Temporal)
  "41", // Pasaporte
  "12", // Tarjeta de identidad
]);

export const isDvApplicable = (dianDocType?: string | null): boolean => {
  if (!dianDocType) return true;
  return documentTypesSupportingDv.has(dianDocType);
};
