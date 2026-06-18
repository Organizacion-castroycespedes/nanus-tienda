"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  UserPlus,
  Wallet,
} from "lucide-react";
import { fetchProfile } from "../../../domains/auth/api";
import { fetchSystemVersion } from "../../../domains/system/api";
import type { AuthUser } from "../../../domains/auth/types";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { setUser } from "../../../store/authSlice";
import { getCurrentCashSession } from "../../../modules/finance/services/finance.service";
import type { CashSession } from "../../../modules/finance/types";
import { formatCurrency } from "../../../modules/finance/utils";
import { HomeHero } from "../../../components/home/HomeHero";
import { QuickActions } from "../../../components/home/QuickActions";
import { ModulesGrid } from "../../../components/home/ModulesGrid";
import {
  SummaryCards,
  summaryIcons,
  type SummaryCardData,
} from "../../../components/home/SummaryCards";
import {
  Recommendations,
  type Recommendation,
} from "../../../components/home/Recommendations";

const DEFAULT_VERSION = "v0.0.1";

const DashboardPage = () => {
  const params = useParams();
  const tenant = (params?.tenant as string) || "default";

  const authUser = useAppSelector((state) => state.auth.user);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const companyDetails = useAppSelector((state) => state.company.details);
  const dispatch = useAppDispatch();

  const userName = authUser?.name || authUser?.email || "Usuario";
  const businessName =
    companyDetails?.razonSocial ||
    authUser?.tenantName ||
    "Tienda Castro & Céspedes";

  const [appVersion, setAppVersion] = useState(DEFAULT_VERSION);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashChecked, setCashChecked] = useState(false);
  const [cashError, setCashError] = useState(false);

  // Hydrate profile if missing.
  useEffect(() => {
    const shouldFetchProfile =
      authStatus === "authenticated" &&
      (!authUser?.name || !authUser?.tenantName);
    if (!shouldFetchProfile) {
      return;
    }
    void (async () => {
      try {
        const profile = await fetchProfile();
        const fullName = [profile.persona?.nombres, profile.persona?.apellidos]
          .filter(Boolean)
          .join(" ");
        const nextUser: AuthUser = {
          id: profile.id,
          name: fullName || profile.email,
          email: profile.email,
          role: profile.role?.nombre ?? authUser?.role ?? "",
          tenantId: profile.tenant.id,
          tenantName: profile.tenant.nombre,
          branchId: profile.branch?.id ?? null,
          branchName: profile.branch?.nombre ?? null,
          persona: profile.persona,
        };
        dispatch(setUser(nextUser));
      } catch {
        // ignore profile fetch failures
      }
    })();
  }, [authStatus, authUser, dispatch]);

  // System version.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchSystemVersion();
        if (active && response.version) {
          setAppVersion(
            response.version.startsWith("v")
              ? response.version
              : `v${response.version}`
          );
        }
      } catch {
        if (active) {
          setAppVersion(DEFAULT_VERSION);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Current cash session.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    let active = true;
    void (async () => {
      setCashError(false);
      try {
        const session = await getCurrentCashSession();
        if (active) {
          setCashSession(session);
        }
      } catch {
        if (active) {
          setCashSession(null);
          setCashError(true);
        }
      } finally {
        if (active) {
          setCashChecked(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, authUser?.id]);

  const cashOpen = Boolean(cashSession);

  const summaryCards = useMemo<SummaryCardData[]>(() => {
    const cashCard: SummaryCardData = cashError
      ? {
          key: "cash",
          label: "Caja actual",
          icon: summaryIcons.cash,
          status: "error",
          hint: "No se pudo consultar la caja.",
        }
      : cashOpen
        ? {
            key: "cash",
            label: "Caja actual",
            icon: summaryIcons.cash,
            status: "data",
            value: formatCurrency(cashSession?.openingAmount ?? 0),
            hint: `Caja abierta · ${cashSession?.cashRegisterNombre ?? "Sin nombre"}`,
          }
        : {
            key: "cash",
            label: "Caja actual",
            icon: summaryIcons.cash,
            status: "empty",
            hint: cashChecked
              ? "No hay caja abierta."
              : "Consultando estado de caja…",
          };

    return [
      {
        key: "sales",
        label: "Ventas de hoy",
        icon: summaryIcons.sales,
        status: cashOpen ? "data" : "empty",
        value: cashOpen ? formatCurrency(0) : undefined,
        hint: cashOpen
          ? "Sin ventas registradas aún."
          : "Abre caja para registrar ventas.",
      },
      cashCard,
      {
        key: "orders",
        label: "Pedidos pendientes",
        icon: summaryIcons.orders,
        status: "data",
        value: "0",
        hint: "Ningún pedido pendiente.",
      },
      {
        key: "stock",
        label: "Productos con bajo stock",
        icon: summaryIcons.stock,
        status: "data",
        value: "0",
        hint: "Inventario en niveles normales.",
      },
    ];
  }, [cashError, cashOpen, cashChecked, cashSession]);

  const recommendations = useMemo<Recommendation[]>(() => {
    const items: Recommendation[] = [];
    if (!cashOpen) {
      items.push({
        key: "abrir-caja",
        title: "Abre caja para iniciar ventas.",
        href: `/${tenant}/finance`,
        icon: Wallet,
        highlight: true,
      });
    }
    items.push(
      {
        key: "bajo-stock",
        title: "Revisa productos con bajo stock.",
        href: `/${tenant}/inventory`,
        icon: Boxes,
      },
      {
        key: "pedidos",
        title: "Consulta pedidos pendientes.",
        href: `/${tenant}/orders`,
        icon: ClipboardList,
      },
      {
        key: "clientes",
        title: "Registra clientes frecuentes.",
        href: `/${tenant}/customers`,
        icon: UserPlus,
      }
    );
    return items;
  }, [cashOpen, tenant]);

  return (
    <div className="space-y-8">
      <HomeHero
        tenant={tenant}
        userName={userName}
        businessName={businessName}
        version={appVersion}
      />

      <QuickActions tenant={tenant} />

      <SummaryCards cards={summaryCards} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ModulesGrid tenant={tenant} />
        <Recommendations recommendations={recommendations} />
      </div>
    </div>
  );
};

export default DashboardPage;
