export const FISCAL_PERSON_TYPE_OPTIONS = [
  { value: "NATURAL", label: "Persona natural" },
  { value: "JURIDICA", label: "Persona jurídica (Empresa)" },
] as const;

export const FISCAL_TAX_REGIME_OPTIONS = [
  { value: "ORDINARIO", label: "Responsable de IVA (Ordinario)" },
  { value: "NO_RESPONSABLE", label: "No responsable de IVA" },
  { value: "SIMPLE", label: "Régimen Simple de Tributación (RST)" },
  { value: "ESPECIAL", label: "Régimen Especial" },
] as const;

export const FISCAL_RESPONSIBILITY_OPTIONS = [
  { value: "R-99-PN", label: "R-99-PN · No responsable de IVA" },
  { value: "O-13", label: "O-13 · Gran contribuyente" },
  { value: "O-15", label: "O-15 · Autorretenedor" },
  { value: "O-23", label: "O-23 · Agente de retención IVA" },
  { value: "O-47", label: "O-47 · Régimen simple de tributación" },
] as const;
