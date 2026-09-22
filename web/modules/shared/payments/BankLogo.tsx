import React from "react";
import { Building2, Wallet, CreditCard, Landmark } from "lucide-react";

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
  BBVA: "/payment-institutions/bbva.svg",
  BANCO_POPULAR: "/payment-institutions/banco-popular.svg",
  BANCO_AV_VILLAS: "/payment-institutions/av-villas.svg",
  SCOTIABANK_COLPATRIA: "/payment-institutions/scotiabank.svg",
  ITAU: "/payment-institutions/itau.svg",
  BANCO_AGRARIO: "/payment-institutions/banco-agrario.svg",
};

export const BankLogo: React.FC<BankLogoProps> = ({ code, name, logoUrl, className = "h-8 w-8" }) => {
  // Ignore the old generated Base64 SVGs. They were placeholders, not official brand assets.
  if (logoUrl && !logoUrl.startsWith("data:image/svg+xml;base64,")) {
    return <img src={logoUrl} alt={name || "Banco"} className={`object-contain ${className}`} />;
  }

  const canonicalLogo = code ? CANONICAL_LOGO_BY_CODE[code.toUpperCase()] : undefined;
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
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#000000" />
        <path d="M22 66 C20 40 40 22 62 22 C74 22 80 28 78 36 C74 44 58 48 42 50 C26 52 20 60 22 66" fill="none" stroke="#FDDA24" strokeWidth="9" strokeLinecap="round" />
        <path d="M62 22 C74 22 80 28 78 36" fill="none" stroke="#00C1D5" strokeWidth="7" strokeLinecap="round" />
      </svg>
    );
  }

  if (normalized.includes("nequi")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#1F0326" />
        <g transform="translate(22, 22)">
          <rect x="0" y="0" width="14" height="56" rx="4" fill="#FF007A" />
          <rect x="42" y="0" width="14" height="56" rx="4" fill="#FF007A" />
          <path d="M12 12 L44 44" stroke="#00FFF0" strokeWidth="12" strokeLinecap="round" />
          <circle cx="49" cy="7" r="5" fill="#00FFF0" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("daviplata") || normalized.includes("davi")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#ED1C24" />
        <g transform="translate(18, 18)">
          <circle cx="32" cy="20" r="10" fill="#FFFFFF" />
          <path d="M10 50 C10 32 24 24 38 34 C48 42 56 46 54 54 C52 60 40 60 32 56 Z" fill="#FFFFFF" />
          <path d="M38 34 C48 24 58 26 56 36 C54 44 46 46 38 44 Z" fill="#FFDD00" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("davivienda")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#ED1C24" />
        <g transform="translate(18, 20)">
          <rect x="8" y="10" width="10" height="16" fill="#FFFFFF" rx="1" />
          <polygon points="32,4 64,32 0,32" fill="#FFFFFF" />
          <rect x="6" y="32" width="52" height="34" fill="#FFFFFF" rx="1" />
          <rect x="24" y="44" width="16" height="22" rx="3" fill="#ED1C24" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("bogota")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#002D72" />
        <circle cx="50" cy="50" r="32" fill="#F8B100" />
        <circle cx="50" cy="50" r="22" fill="#002D72" />
        <circle cx="50" cy="50" r="12" fill="#F8B100" />
        <circle cx="50" cy="50" r="5" fill="#002D72" />
      </svg>
    );
  }

  if (normalized.includes("bbva")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#004481" />
        <g transform="translate(10, 32)">
          <text x="40" y="28" fill="#FFFFFF" fontSize="25" fontWeight="900" fontFamily="'Segoe UI', Arial, sans-serif" letterSpacing="1" textAnchor="middle">
            BBVA
          </text>
        </g>
      </svg>
    );
  }

  if (normalized.includes("popular")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#007A33" />
        <g transform="translate(24, 22)">
          <path d="M0 0 H28 C42 0 48 10 48 22 C48 34 40 44 26 44 H14 V58 H0 Z" fill="#FFFFFF" />
          <path d="M14 12 H26 C32 12 34 16 34 22 C34 28 32 32 26 32 H14 Z" fill="#007A33" />
          <circle cx="26" cy="22" r="5" fill="#FFC72C" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("villas")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#00529B" />
        <g transform="translate(20, 20)">
          <circle cx="30" cy="30" r="28" fill="none" stroke="#00A3E0" strokeWidth="6" />
          <circle cx="30" cy="30" r="18" fill="none" stroke="#E31B23" strokeWidth="5" />
          <text x="30" y="37" fill="#FFFFFF" fontSize="20" fontWeight="900" fontFamily="Arial, sans-serif" textAnchor="middle">
            AV
          </text>
        </g>
      </svg>
    );
  }

  if (normalized.includes("scotiabank") || normalized.includes("patria")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#EC111A" />
        <g transform="translate(24, 20)">
          <path d="M42 12 C38 4 28 0 18 4 C8 8 2 18 4 28 C6 38 18 44 28 48 C38 52 46 56 46 64 C46 72 38 78 26 76 C14 74 6 64 6 64" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("itau")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#EC6608" />
        <rect x="18" y="18" width="64" height="64" rx="16" fill="#0033A0" />
        <text x="50" y="58" fill="#FED100" fontSize="24" fontWeight="900" fontFamily="'Segoe UI', Arial, sans-serif" textAnchor="middle">
          itaú
        </text>
      </svg>
    );
  }

  if (normalized.includes("agrario")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="20" fill="#005928" />
        <g transform="translate(25, 20)">
          <path d="M25 60 C25 35 48 10 48 10 C48 10 50 35 32 50 C26 55 25 60 25 60 Z" fill="#FED100" />
          <path d="M25 60 C25 40 6 25 6 25 C6 25 4 45 18 54 C22 57 25 60 25 60 Z" fill="#FFFFFF" />
          <circle cx="25" cy="58" r="4" fill="#FED100" />
        </g>
      </svg>
    );
  }

  if (normalized.includes("bre-b") || normalized.includes("breb") || normalized.includes("qr")) {
    return (
      <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name || "QR Bre-B"}>
        <rect width="100" height="100" rx="20" fill="#0F766E" />
        <path d="M24 24h20v20H24zM56 24h20v20H56zM24 56h20v20H24z" fill="none" stroke="#fff" strokeWidth="7" />
        <path d="M58 58h8v8h-8zM70 58h6v18h-6zM58 70h8v6h-8z" fill="#FDE047" />
      </svg>
    );
  }

  if (normalized.includes("wallet") || normalized.includes("billetera")) {
    return <Wallet className={`${className} text-slate-500`} />;
  }

  return <Landmark className={`${className} text-slate-500`} />;
};
