"use client";

import Link from "next/link";
import { Loader2, Lock, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../../store/hooks";
import { getCurrentCashSession } from "../../../modules/finance/services/finance.service";
import type { CashSession } from "../../../modules/finance/types";
import { PosScreen } from "../../../modules/pos/components/PosScreen";
import { useRequirePosSession } from "../../../domains/pos/hooks/useRequirePosSession";

const PosBlockedState = ({
  tenantSlug,
  title,
  description,
  loading = false,
}: {
  tenantSlug: string;
  title: string;
  description: string;
  loading?: boolean;
}) => (
  <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-white p-8 shadow-sm dark:bg-slate-800">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Lock className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          POS requiere caja
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${tenantSlug}/pos/select-context`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Wallet className="h-4 w-4" />
            Seleccionar contexto y abrir caja
          </Link>
          <Link
            href={`/${tenantSlug}/dashboard`}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const PosPage = () => {
  const { hasSession } = useRequirePosSession({ redirect: false });
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const tenantSlug = useAppSelector((state) => state.auth.user?.tenantSlug ?? state.auth.user?.tenantId ?? "default");
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const posCashRegisterId = useAppSelector((state) => state.pos.cashRegisterId);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [loadingCashSession, setLoadingCashSession] = useState(true);
  const [cashSessionError, setCashSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapped || authStatus !== "authenticated" || !hasSession) {
      setLoadingCashSession(false);
      setCashSession(null);
      return;
    }

    let active = true;
    setLoadingCashSession(true);
    setCashSessionError(null);

    void getCurrentCashSession(posCashRegisterId ?? undefined)
      .then((session) => {
        if (!active) {
          return;
        }
        setCashSession(session);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCashSession(null);
        setCashSessionError("No se pudo validar la caja abierta.");
      })
      .finally(() => {
        if (active) {
          setLoadingCashSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authStatus, bootstrapped, hasSession, posCashRegisterId]);

  if (!bootstrapped || authStatus === "refreshing") {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Validando sesion"
        description="Estamos confirmando tu sesion antes de habilitar el POS."
        loading
      />
    );
  }

  if (!hasSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Selecciona contexto operativo"
        description="Antes de vender debes seleccionar sucursal, terminal y abrir una caja autorizada."
      />
    );
  }

  if (loadingCashSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Validando caja abierta"
        description="Estamos revisando si tienes una caja abierta para operar el POS."
        loading
      />
    );
  }

  if (cashSessionError) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="No se pudo validar la caja"
        description={cashSessionError}
      />
    );
  }

  if (!cashSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="No tienes caja abierta"
        description="El POS esta bloqueado para ventas hasta abrir una caja en tu contexto autorizado."
      />
    );
  }

  if (posBranchId && cashSession.branchId !== posBranchId) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="La caja abierta no coincide con la sucursal POS"
        description="Cambia el contexto operativo o cierra la caja actual antes de iniciar ventas."
      />
    );
  }

  return <PosScreen />;
};

export default PosPage;
