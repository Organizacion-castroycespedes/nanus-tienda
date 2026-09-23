import React from "react";
import { Building2, Wallet, CreditCard, Landmark, Smartphone, QrCode } from "lucide-react";

type BankLogoProps = {
  code?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  className?: string;
};

const CANONICAL_LOGO_BY_CODE: Record<string, string> = {
  BANCOLOMBIA: "/payment-institutions/bancolombia.svg",
  NEQUI: "/payment-institutions/nequi.svg",
  DAVIVIENDA: "/payment-institutions/davivienda.png",
  BANCO_BOGOTA: "/payment-institutions/banco-bogota.svg",
  BANCO_DE_BOGOTA: "/payment-institutions/banco-bogota.svg",
  BOGOTA: "/payment-institutions/banco-bogota.svg",
  BBVA: "/payment-institutions/bbva.svg",
  BANCO_BBVA: "/payment-institutions/bbva.svg",
  BANCO_POPULAR: "/payment-institutions/banco-popular.svg",
  POPULAR: "/payment-institutions/banco-popular.svg",
  BANCO_AV_VILLAS: "/payment-institutions/av-villas.svg",
  AV_VILLAS: "/payment-institutions/av-villas.svg",
  AVVILLAS: "/payment-institutions/av-villas.svg",
  SCOTIABANK_COLPATRIA: "/payment-institutions/scotiabank.svg",
  COLPATRIA: "/payment-institutions/scotiabank.svg",
  SCOTIABANK: "/payment-institutions/scotiabank.svg",
  ITAU: "/payment-institutions/itau.svg",
  BANCO_ITAU: "/payment-institutions/itau.svg",
  BANCO_AGRARIO: "/payment-institutions/banco-agrario.svg",
  AGRARIO: "/payment-institutions/banco-agrario.svg",
};

export const BankLogo: React.FC<BankLogoProps> = ({ code, name, logoUrl, className = "h-7 w-auto max-h-7 max-w-full" }) => {
  // Use custom logoUrl if valid external URL
  if (logoUrl && !logoUrl.startsWith("data:image/svg+xml;base64,")) {
    return <img src={logoUrl} alt={name || "Banco"} className={`object-contain ${className}`} />;
  }

  const normalizedCode = (code || "").toUpperCase().replace(/[-\s]/g, "_");

  // Specific Daviplata vector brand logo
  if (normalizedCode === "DAVIPLATA" || (name || "").toLowerCase().includes("daviplata")) {
    return (
      <svg viewBox="0 0 100 100" className={className || "h-7 w-7"} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="22" fill="#ED1C24" />
        <g transform="translate(18, 16)">
          <circle cx="32" cy="18" r="11" fill="#FFFFFF" />
          <path d="M12 52 C12 34 26 24 40 34 C50 42 58 48 56 56 C54 62 42 62 34 58 Z" fill="#FFFFFF" />
          <path d="M40 34 C50 24 60 26 58 36 C56 44 48 46 40 44 Z" fill="#FFDD00" />
        </g>
      </svg>
    );
  }

  const canonicalLogo = CANONICAL_LOGO_BY_CODE[normalizedCode];
  if (canonicalLogo) {
    return (
      <img
        src={canonicalLogo}
        alt={name || code || "Entidad financiera"}
        className={`object-contain ${className}`}
      />
    );
  }

  const normalized = (code || name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("bancolombia")) {
    return <img src="/payment-institutions/bancolombia.svg" alt="Bancolombia" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("nequi")) {
    return <img src="/payment-institutions/nequi.svg" alt="Nequi" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("davivienda")) {
    return <img src="/payment-institutions/davivienda.png" alt="Davivienda" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("bogota")) {
    return <img src="/payment-institutions/banco-bogota.svg" alt="Banco de Bogotá" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("bbva")) {
    return <img src="/payment-institutions/bbva.svg" alt="BBVA" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("popular")) {
    return <img src="/payment-institutions/banco-popular.svg" alt="Banco Popular" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("villas")) {
    return <img src="/payment-institutions/av-villas.svg" alt="Banco AV Villas" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("scotiabank") || normalized.includes("patria")) {
    return <img src="/payment-institutions/scotiabank.svg" alt="Scotiabank Colpatria" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("itau")) {
    return <img src="/payment-institutions/itau.svg" alt="Itaú" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("agrario")) {
    return <img src="/payment-institutions/banco-agrario.svg" alt="Banco Agrario" className={`object-contain ${className}`} />;
  }

  if (normalized.includes("bre-b") || normalized.includes("breb") || normalized.includes("qr")) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-teal-700 p-1 text-white shadow-sm">
        <QrCode className="h-5 w-5 text-amber-300" />
      </div>
    );
  }

  if (normalized.includes("wallet") || normalized.includes("billetera")) {
    return <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
  }

  return <Landmark className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />;
};
