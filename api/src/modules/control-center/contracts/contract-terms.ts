import fs from "node:fs";
import path from "node:path";

export type ContractClause = { title: string; paragraphs: string[] };

/**
 * Cláusulas base del contrato. Son una plantilla general para revisar con
 * asesoría legal; se reemplazan con CONTROL_CENTER_CONTRACT_TERMS_FILE.
 * {{instrucciones_pago}} se sustituye por CONTROL_CENTER_PAYMENT_INSTRUCTIONS.
 */
export const DEFAULT_CONTRACT_CLAUSES: ContractClause[] = [
  {
    title: "Objeto",
    paragraphs: [
      "EL PRESTADOR otorga a EL CLIENTE una licencia de uso no exclusiva e intransferible del software MANUS POS en modalidad de servicio en la nube, para el tenant y el número de terminales POS indicados en este documento, durante la vigencia del contrato.",
    ],
  },
  {
    title: "Vigencia, período de prueba y renovación",
    paragraphs: [
      "El contrato inicia en la fecha indicada. Si se pactó un período de prueba, la facturación comienza al terminar la prueba. Al finalizar el término inicial, el contrato podrá renovarse en las condiciones de renovación vigentes, de forma mensual o anual, lo cual se registrará como una nueva versión del contrato.",
    ],
  },
  {
    title: "Precio y forma de pago",
    paragraphs: [
      "Los valores de este documento incluyen el impuesto indicado. El pago es anticipado y vence el día de corte de cada período. Los pagos se aplican a los cargos pendientes del más antiguo al más reciente.",
      "{{instrucciones_pago}}",
    ],
  },
  {
    title: "Terminales adicionales y cambios",
    paragraphs: [
      "La adición o retiro de terminales POS u otros servicios se formaliza mediante una nueva versión del contrato. Cuando el cambio ocurre dentro de un período ya facturado y la política de prorrateo es diaria, se genera un cargo o un crédito proporcional a los días restantes del período.",
    ],
  },
  {
    title: "Mora y recordatorios",
    paragraphs: [
      "EL PRESTADOR enviará recordatorios de pago por los canales registrados (aviso en el sistema, correo electrónico y, si EL CLIENTE lo autoriza, WhatsApp) antes y después del vencimiento de cada cargo.",
    ],
  },
  {
    title: "Certificado de resolución DIAN",
    paragraphs: [
      "Cuando el plan lo incluya, EL PRESTADOR gestiona el certificado requerido para la facturación electrónica con la DIAN por el período indicado. En los planes en que se cobra aparte, su valor anual figura en la tabla de condiciones.",
    ],
  },
  {
    title: "Soporte y actualizaciones",
    paragraphs: [
      "El servicio incluye soporte técnico por los canales de EL PRESTADOR y las actualizaciones del software publicadas durante la vigencia. Los desarrollos a la medida, integraciones, migraciones, capacitaciones adicionales y hardware se cotizan por separado.",
    ],
  },
  {
    title: "Terminación",
    paragraphs: [
      "Cualquiera de las partes podrá terminar el contrato informándolo a la otra. La terminación no extingue las obligaciones de pago causadas hasta la fecha de terminación.",
    ],
  },
  {
    title: "Tratamiento de datos personales",
    paragraphs: [
      "Las partes tratarán los datos personales conforme a la Ley 1581 de 2012 y sus normas reglamentarias. EL PRESTADOR trata los datos de EL CLIENTE para la prestación del servicio, la facturación y el envío de comunicaciones relacionadas con el contrato.",
    ],
  },
];

/** Interpreta un archivo de cláusulas: líneas "## Título" y párrafos separados por líneas en blanco. */
export const parseContractTerms = (text: string): ContractClause[] => {
  const clauses: ContractClause[] = [];
  let current: ContractClause | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const paragraph = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph && current) current.paragraphs.push(paragraph);
    buffer = [];
  };
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading) {
      flush();
      current = { title: heading[1].trim(), paragraphs: [] };
      clauses.push(current);
    } else if (!line.trim()) {
      flush();
    } else {
      buffer.push(line.trim());
    }
  }
  flush();
  return clauses.filter((clause) => clause.paragraphs.length > 0);
};

/** Cláusulas del archivo configurado o, si no existe o está vacío, las cláusulas base. */
export const loadContractTerms = (env: Record<string, string | undefined> = process.env, cwd = process.cwd()): ContractClause[] => {
  const file = env.CONTROL_CENTER_CONTRACT_TERMS_FILE?.trim();
  if (!file) return DEFAULT_CONTRACT_CLAUSES;
  try {
    const parsed = parseContractTerms(fs.readFileSync(path.resolve(cwd, file), "utf8"));
    return parsed.length > 0 ? parsed : DEFAULT_CONTRACT_CLAUSES;
  } catch {
    return DEFAULT_CONTRACT_CLAUSES;
  }
};

export const applyPaymentInstructions = (clauses: ContractClause[], instructions: string | null): ContractClause[] =>
  clauses.map((clause) => ({
    title: clause.title,
    paragraphs: clause.paragraphs
      .map((paragraph) =>
        paragraph.includes("{{instrucciones_pago}}")
          ? instructions
            ? paragraph.replace("{{instrucciones_pago}}", `Medios de pago: ${instructions.replace(/\n/g, " · ")}`)
            : ""
          : paragraph,
      )
      .filter((paragraph) => paragraph.length > 0),
  }));
