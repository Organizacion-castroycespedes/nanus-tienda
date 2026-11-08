"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Toast } from "../../../components/design-system/Toast";
import { listTenantDirectory } from "../api";
import { apiErrorMessage } from "../errors";
import type { TenantDirectoryEntry } from "../types";
import { ControlCenterShell, useControlCenterAccess, useControlCenterHref } from "./ControlCenterShell";
import { ContractStatusBadge, Pill } from "./StatusBadge";

export const TenantsDirectory = () => {
  const { visible } = useControlCenterAccess();
  const href = useControlCenterHref();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TenantDirectoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTenantDirectory({ search: query, cursor, limit: 25 });
      setRows((current) => (append ? [...current, ...result.items] : result.items));
      setNextCursor(result.nextCursor);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (visible) void load(null, false);
  }, [load, visible]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const columns: DataTableColumn<TenantDirectoryEntry>[] = [
    {
      key: "tenant",
      header: "Tenant",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.name ?? row.slug}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.legalName ?? "—"} · NIT {row.taxId ?? "—"}{row.dv ? `-${row.dv}` : ""}</p>
        </div>
      ),
    },
    { key: "branches", header: "Sucursales", render: (row) => row.activeBranches },
    {
      key: "terminals",
      header: "Terminales POS",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>
            {row.activePosTerminals}
            {row.contract ? ` / ${row.contract.contractedPosTerminals}` : ""}
          </span>
          {row.terminalStatus === "EXCEEDED" ? <Pill tone="danger">Excedido</Pill> : null}
          {row.terminalStatus === "OK" ? <Pill tone="ok">OK</Pill> : null}
        </div>
      ),
    },
    {
      key: "account",
      header: "Cuenta comercial",
      render: (row) =>
        row.link ? (
          <span className="text-slate-700 dark:text-slate-200">{row.link.accountLegalName}</span>
        ) : (
          <Pill tone="warn">Sin vincular</Pill>
        ),
    },
    {
      key: "contract",
      header: "Contrato",
      render: (row) =>
        row.contract ? (
          <Link href={href(`contracts/${row.contract.id}`)} className="inline-flex items-center gap-2 text-blue-600 hover:underline dark:text-blue-400">
            {row.contract.number} <ContractStatusBadge status={row.contract.status} />
          </Link>
        ) : (
          <Pill tone="muted">Sin contrato</Pill>
        ),
    },
    { key: "status", header: "Estado", render: (row) => (row.active ? <Pill tone="ok">Activo</Pill> : <Pill tone="muted">Inactivo</Pill>) },
  ];

  return (
    <ControlCenterShell
      section="tenants"
      description="Tenants existentes en MANUS con su uso real y su situación comercial (solo lectura)"
      toolbar={
        <Button variant="outline" size="sm" onClick={() => void load(null, false)} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Actualizar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="max-w-md">
          <Input label="Buscar" placeholder="Nombre, slug, razón social o NIT" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {error ? <Toast variant="error" message={error} /> : null}
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          loading={loading && rows.length === 0}
          emptyState="No hay tenants que coincidan con la búsqueda."
        />
        {nextCursor ? (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => void load(nextCursor, true)} isLoading={loading}>
              Cargar más
            </Button>
          </div>
        ) : null}
      </div>
    </ControlCenterShell>
  );
};
