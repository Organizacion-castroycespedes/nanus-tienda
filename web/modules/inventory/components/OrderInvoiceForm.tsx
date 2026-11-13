"use client";

import { Banknote, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { getCurrentPosSession } from "../../../domains/pos/api";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { buildTenantPath, resolveTenantSlug } from "../../../domains/auth/tenant-path";
import { useAppSelector } from "../../../store/hooks";
import { getCurrentCashSession } from "../../finance/services/finance.service";
import type { CashSession } from "../../finance/types";
import { DocumentPaymentForm } from "../../finance/components/DocumentPaymentForm";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../hooks/use-confirm";
import {
  getOrderById,
  invoiceOrder,
  type OrderDetailResponse,
} from "../services/order.service";
import { buildConfirmFromApiError } from "../../../lib/api-messages";

type OrderInvoiceFormProps = {
  orderId: string;
  onCancel: () => void;
  onSuccess: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const round = (value: number) => Number(value.toFixed(2));

export const OrderInvoiceForm = ({
  orderId,
  onCancel,
  onSuccess,
}: OrderInvoiceFormProps) => {
  const router = useRouter();
  const confirm = useConfirm();
  const tenantId = useAppSelector((state) => state.auth.tenantId ?? state.auth.user?.tenantId);
  const authUser = useAppSelector((state) => state.auth.user);
  const tenantSlugState = useAppSelector((state) => state.auth.tenantSlug);
  const {
    branchId: posBranchId,
    terminalId: posTerminalId,
    posSessionId,
    setSession: setPosSession,
  } = usePosContext();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [result, currentSession, currentPosSession] = await Promise.all([
          getOrderById(orderId),
          getCurrentCashSession(),
          getCurrentPosSession().catch(() => null),
        ]);
        if (!mounted) {
          return;
        }

        if (currentPosSession?.posSessionId) {
          setPosSession({
            posSessionId: currentPosSession.posSessionId,
            branchId: currentPosSession.branchId,
            terminalId: currentPosSession.terminalId,
          });
        }
        setOrder(result);
        setCashSession(currentSession);
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle del pedido.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [orderId, setPosSession]);

  const rows = useMemo(() => {
    if (!order) {
      return [];
    }

    return order.items
      .map((item) => {
        const invoiceableQuantity = Math.max(item.deliveredQuantity - item.billedQuantity, 0);
        return {
          item,
          invoiceableQuantity,
          subtotal: invoiceableQuantity * item.price,
        };
      })
      .filter((row) => row.invoiceableQuantity > 0);
  }, [order]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.subtotal, 0),
    [rows]
  );

  const inheritedPayments = useMemo(() => {
    const sourcePayments = [...(order?.payments ?? [])];
    let remaining = round(total);

    return sourcePayments
      .map((payment) => {
        const inheritedAmount = round(Math.min(payment.availableAmount, remaining));
        remaining = round(Math.max(remaining - inheritedAmount, 0));

        return {
          ...payment,
          inheritedAmount,
        };
      })
      .filter((payment) => payment.inheritedAmount > 0);
  }, [order?.payments, total]);

  const inheritedTotal = useMemo(
    () => round(inheritedPayments.reduce((sum, payment) => sum + payment.inheritedAmount, 0)),
    [inheritedPayments]
  );

  const remainingToCover = useMemo(
    () => round(Math.max(total - inheritedTotal, 0)),
    [inheritedTotal, total]
  );

  /** Recarga el pedido tras registrar un abono: la factura lo hereda y el saldo baja. */
  const reloadOrder = useCallback(async () => {
    try {
      setOrder(await getOrderById(orderId));
    } catch {
      setPaymentNotice(
        "El pago se registró, pero no se pudo actualizar el detalle. Vuelve a abrir la facturación."
      );
    }
  }, [orderId]);
  const cashSessionMatchesBranch = !cashSession || cashSession.branchId === order?.branchId;
  const hasPosSession = Boolean(posSessionId && posBranchId && posTerminalId);
  const posSessionMatchesBranch =
    !order?.branchId || !posBranchId || posBranchId === order.branchId;
  const contextTarget = buildTenantPath(
    resolveTenantSlug({
      tenantSlug: tenantSlugState ?? authUser?.tenantSlug,
      tenantId: tenantId ?? authUser?.tenantId,
    }),
    "pos/select-context"
  );

  const validate = () => {
    if (rows.length === 0) {
      return "No hay productos entregados pendientes por facturar.";
    }

    if (!hasPosSession) {
      return "Necesitas seleccionar contexto POS y abrir caja antes de facturar este pedido.";
    }

    if (!posSessionMatchesBranch) {
      return "La sesion POS activa pertenece a otra sucursal. Selecciona contexto para la sucursal del pedido.";
    }

    if (!cashSession?.id) {
      return "Debes tener una caja abierta para facturar el pedido.";
    }

    if (type === "CASH" && remainingToCover > 0) {
      return "Registra el pago del saldo antes de facturar: las ventas CASH deben quedar cubiertas con abonos.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await confirm({
        title: "Crear venta",
        description:
          "Se creará la venta usando los productos entregados pendientes por facturar y se heredarán los abonos previos de la orden.",
        confirmText: "Crear venta",
        cancelText: "Volver",
        variant: "warning",
      });

      // El saldo se cobra antes con el modal de abonos; la función de facturación
      // hereda esos abonos, por lo que no se envían pagos nuevos.
      await invoiceOrder(orderId, {
        type,
        payments: [],
      });
      onSuccess();
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      const apiMessage = error instanceof Error ? error.message : "";
      if (/sesion pos/i.test(apiMessage)) {
        const message =
          "Necesitas seleccionar contexto POS y abrir caja antes de facturar este pedido.";
        setSubmitError(message);
        await confirm({
          title: "Caja requerida",
          description: message,
          confirmText: "Entendido",
          hideCancel: true,
          variant: "warning",
        });
        return;
      }
      const dialog = buildConfirmFromApiError(
        error,
        "No se pudo crear la venta desde la orden."
      );
      setSubmitError(dialog.description ?? "No se pudo crear la venta desde la orden.");
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Facturar orden</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Crea una venta usando solo los productos entregados y no facturados.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle del pedido...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : order ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.customerName || order.customerId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.branchName || order.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.terminalName || "-"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div
              className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
              role="region"
              aria-label="Productos del pedido para facturar"
              tabIndex={0}
            >
              <table className="w-full min-w-[760px] table-fixed divide-y divide-slate-200 text-sm">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 text-right font-medium">Entregado</th>
                    <th className="px-4 py-3 text-right font-medium">Facturado</th>
                    <th className="px-4 py-3 text-right font-medium">Facturar ahora</th>
                    <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        No hay productos entregados pendientes por facturar.
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ item, invoiceableQuantity, subtotal }) => (
                      <tr key={item.id}>
                        <td className="break-words px-4 py-3 leading-5 text-slate-900 dark:text-white">
                          {item.productName || item.productId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{item.deliveredQuantity}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{item.billedQuantity}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{invoiceableQuantity}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de venta"
              value={type}
              onChange={(event) => setType(event.target.value as "CASH" | "CREDIT")}
            >
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </Select>
            <Input
              label="Saldo por cubrir"
              value={formatCurrency(remainingToCover)}
              disabled
              readOnly
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Wallet className="h-4 w-4" />
              Caja y abonos heredados
            </div>
            {!hasPosSession ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Selecciona contexto POS antes de facturar.</p>
                <p className="mt-1">
                  La factura crea una venta y necesita sesion POS valida en la sucursal del pedido.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(contextTarget)}
                >
                  Ir a seleccion de contexto
                </Button>
              </div>
            ) : !posSessionMatchesBranch ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">La sesion POS activa no coincide con la sucursal.</p>
                <p className="mt-1">
                  Cambia el contexto POS a la sucursal del pedido antes de facturar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push(contextTarget)}
                >
                  Cambiar contexto
                </Button>
              </div>
            ) : null}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
              {cashSession
                ? `${cashSession.cashRegisterNombre ?? "Caja"} abierta con fondo ${formatCurrency(
                    cashSession.openingAmount
                  )}.`
                : "No hay una caja abierta para este usuario."}
              {cashSession && !cashSessionMatchesBranch ? (
                <p className="mt-2 text-amber-700">
                  La caja abierta actual pertenece a otra sucursal. Los pagos en efectivo de esta
                  sucursal serán bloqueados.
                </p>
              ) : null}
            </div>
            {inheritedPayments.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Esta orden no tiene abonos pendientes para heredar a la factura.
              </p>
            ) : (
              <div className="space-y-3">
                {inheritedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700"
                  >
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Metodo</p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {payment.paymentMethodNombre ?? payment.paymentMethodId}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Abono orden</p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Disponible para factura
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                          {formatCurrency(payment.availableAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-700">
                          Se aplicara ahora
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-950">
                          {formatCurrency(payment.inheritedAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {remainingToCover > 0 ? (
            <section
              aria-label="Pagos nuevos"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10"
            >
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Pagos nuevos</h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Saldo por cubrir: <span className="font-semibold">{formatCurrency(remainingToCover)}</span>.{" "}
                  {type === "CASH"
                    ? "Las ventas CASH deben quedar cubiertas antes de facturar."
                    : "En CREDIT puedes facturar con saldo pendiente."}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  El pago se registra como abono del pedido y la factura lo hereda.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setPaymentNotice(null);
                  setPaymentModalOpen(true);
                }}
                disabled={isSubmitting}
              >
                <Banknote className="h-4 w-4" />
                Registrar pago
              </Button>
            </section>
          ) : null}

          {paymentNotice ? (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {paymentNotice}
            </p>
          ) : null}

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Total a facturar
                </p>
                <p className="text-sm text-emerald-900/80">
                  Solo se incluyen cantidades entregadas y pendientes por facturar.
                </p>
              </div>
              <p className="text-xl font-semibold text-emerald-950">{formatCurrency(total)}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Abonos heredados
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">
                  {formatCurrency(inheritedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Saldo resultante
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">
                  {formatCurrency(remainingToCover)}
                </p>
              </div>
            </div>
          </section>

          {submitError ? (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p>{submitError}</p>
              {submitError.toLowerCase().includes("pos") ||
              submitError.toLowerCase().includes("sucursal") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(contextTarget)}
                >
                  Ir a seleccion de contexto
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting} disabled={rows.length === 0}>
              Crear venta
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {paymentModalOpen && order ? (
        <DocumentPaymentForm
          title="Cobrar saldo del pedido"
          description="Registra el pago del saldo de esta facturación. Quedará como abono del pedido y se heredará al facturar."
          branchId={order.branchId ?? ""}
          referenceType="SALES_ORDER"
          referenceId={order.id}
          direction="IN"
          partyLabel="Cliente del pedido"
          partyName={order.customerName ?? order.customerId}
          documentLabel={`Pedido ${order.id.slice(0, 8)}`}
          total={Number(order.total)}
          effectiveTotal={total}
          effectiveTotalLabel="Total a facturar"
          totalPaid={Number(order.totalPaid)}
          balanceDue={remainingToCover}
          paymentStatus={order.paymentStatus}
          onCancel={() => setPaymentModalOpen(false)}
          onSuccess={() => {
            setPaymentModalOpen(false);
            setSubmitError(null);
            setPaymentNotice("Pago registrado como abono del pedido; se heredará en la factura.");
            void reloadOrder();
          }}
        />
      ) : null}
    </section>
  );
};
