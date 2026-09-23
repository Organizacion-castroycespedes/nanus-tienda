import React, { useState } from "react";
import { Landmark, Smartphone, QrCode } from "lucide-react";

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

const normalizeCode = (code?: string | null) =>
  (code || "").toUpperCase().replace(/[-\s]/g, "_");

const getInitials = (name?: string | null, code?: string | null) => {
  const source = (name || code || "?").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const InitialsFallback: React.FC<{ name?: string | null; code?: string | null; className?: string }> = ({
  name,
  code,
  className,
}) => (
  <span
    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200 ${className ?? ""}`}
    aria-hidden
  >
    {getInitials(name, code)}
  </span>
);

const LogoImage: React.FC<{
  src: string;
  alt: string;
  className: string;
  name?: string | null;
  code?: string | null;
}> = ({ src, alt, className, name, code }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <InitialsFallback name={name} code={code} className={className} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export const BankLogo: React.FC<BankLogoProps> = ({
  code,
  name,
  logoUrl,
  className = "h-7 w-auto max-h-7 max-w-full",
}) => {
  // Prefer configured logoUrl from API/BD when it is a real URL (not legacy data-URI placeholders)
  if (logoUrl && !logoUrl.startsWith("data:image/svg+xml;base64,")) {
    return (
      <LogoImage
        src={logoUrl}
        alt={name || "Banco"}
        className={className}
        name={name}
        code={code}
      />
    );
  }

  const normalizedCode = normalizeCode(code);

  if (normalizedCode === "DAVIPLATA") {
    return (
      <svg viewBox="0 0 100 100" className={className || "h-7 w-7"} xmlns="http://www.w3.org/2000/svg" aria-label="Daviplata">
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
      <LogoImage
        src={canonicalLogo}
        alt={name || code || "Entidad financiera"}
        className={className}
        name={name}
        code={code}
      />
    );
  }

  if (normalizedCode.includes("BREB") || normalizedCode.includes("QR")) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-teal-700 p-1 text-white shadow-sm">
        <QrCode className="h-5 w-5 text-amber-300" />
      </div>
    );
  }

  if (normalizedCode.includes("WALLET") || normalizedCode.includes("BILLETERA")) {
    return <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
  }

  if (name || code) {
    return <InitialsFallback name={name} code={code} className={className} />;
  }

  return <Landmark className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />;
};
