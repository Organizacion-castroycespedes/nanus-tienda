"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Pencil, Plus, Unlink } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Pagination } from "../../../components/design-system/Pagination";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast } from "../../../components/design-system/Toast";
import { createAccount, getAccount, linkTenant, listAccounts, listTenantDirectory, unlinkTenant, updateAccount } from "../api";
import { apiErrorMessage } from "../errors";
import { formatDate } from "../format";
import type { AccountDetail, CommercialAccount, TaxIdType, TenantDirectoryEntry } from "../types";
import { ControlCenterShell, useControlCenterAccess } from "./ControlCenterShell";
import { ReasonDialog } from "./ReasonDialog";
import { Pill } from "./StatusBadge";

type FormState = {
  legalName: string;
  taxIdType: TaxIdType;
  taxId: string;
  dv: string;
  billingEmail: string;
  contactName: string;
  contactPhoneE164: string;
  whatsappOptIn: boolean;
  address: string;
  city: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: FormState = {
  legalName: "",
  taxIdType: "NIT",
  taxId: "",
  dv: "",
  billingEmail: "",
  contactName: "",
  contactPhoneE164: "",
  whatsappOptIn: false,
  address: "",
  city: "",
  notes: "",
  status: "ACTIVE",
};

const toForm = (account: CommercialAccount): FormState => ({
  legalName: account.legalName,
  taxIdType: account.taxIdType,
  taxId: account.taxId,
  dv: account.dv ?? "",
  billingEmail: account.billingEmail,
  contactName: account.contactName ?? "",
  contactPhoneE164: account.contactPhoneE164 ?? "",
  whatsappOptIn: account.whatsappOptIn,
  address: account.address ?? "",
  city: account.city ?? "",
  notes: account.notes ?? "",
  status: account.status,
});

export const AccountsSection = () => {
  const { visible } = useControlCenterAccess();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: CommercialAccount[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CommercialAccount | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantOptions, setTenantOptions] = useState<TenantDirectoryEntry[]>([]);
  const [unlinking, setUnlinking] = useState<{ tenantId: string; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAccounts({
        search: search.trim(),
        status: status === "all" ? undefined : status.toUpperCase(),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setData({ items: result.items, total: result.total });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load, visible]);

  const openDetail = async (accountId: string) => {
    setNotice(null);
    try {
      setDetail(await getAccount(accountId));
      setTenantSearch("");
      setTenantOptions([]);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  };

  useEffect(() => {
    if (!detail) return;
    const timer = setTimeout(async () => {
      try {
        const result = await listTenantDirectory({ search: tenantSearch.trim(), limit: 10 });
        setTenantOptions(result.items.filter((tenant) => !tenant.link));
      } catch {
        setTenantOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [detail, tenantSearch]);

  const startEdit = (account: CommercialAccount | "new") => {
    setEditing(account);
    setForm(account === "new" ? emptyForm : toForm(account));
    setFormError(null);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const common = {
        legalName: form.legalName,
        dv: form.dv || null,
        billingEmail: form.billingEmail,
        contactName: form.contactName || null,
        contactPhoneE164: form.contactPhoneE164 || null,
        whatsappOptIn: form.whatsappOptIn,
        address: form.address || null,
        city: form.city || null,
        notes: form.notes || null,
      };
      if (editing === "new") {
        await createAccount({ ...common, taxIdType: form.taxIdType, taxId: form.taxId });
      } else if (editing) {
        await updateAccount(editing.id, { ...common, status: form.status });
      }
      setEditing(null);
      await load();
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const doLink = async (tenant: TenantDirectoryEntry) => {
    if (!detail) return;
    try {
      await linkTenant(detail.id, tenant.id);
      setNotice(`Tenant ${tenant.name ?? tenant.slug} vinculado.`);
      await openDetail(detail.id);
      await load();
    } catch (caught) {
      setNotice(apiErrorMessage(caught));
    }
  };

  const columns: DataTableColumn<CommercialAccount>[] = [
    {
      key: "account",
      header: "Cuenta",
      render: (row) => (
        <button type="button" className="text-left" onClick={() => void openDetail(row.id)}>
          <p className="font-medium text-blue-600 hover:underline dark:text-blue-400">{row.legalName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.taxIdType} {row.taxId}{row.dv ? `-${row.dv}` : ""}</p>
        </button>
      ),
    },
    { key: "email", header: "Correo de facturación", render: (row) => row.billingEmail },
    {
      key: "whatsapp",
      header: "WhatsApp",
      render: (row) => (row.whatsappOptIn ? <Pill tone="ok">Autorizado</Pill> : <Pill tone="muted">No</Pill>),
    },
    { key: "tenants", header: "Tenants", render: (row) => row.activeTenants ?? 0 },
    { key: "status", header: "Estado", render: (row) => (row.status === "ACTIVE" ? <Pill tone="ok">Activa</Pill> : <Pill tone="muted">Inactiva</Pill>) },
    {
      key: "actions",
      header: "Acciones",
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => startEdit(row)} aria-label={`Editar ${row.legalName}`}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      ),
    },
  ];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <ControlCenterShell
      section="accounts"
      description="Clientes que pagan a MANUS y sus tenants vinculados"
      toolbar={
        <Button size="sm" onClick={() => startEdit("new")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Nueva cuenta
        </Button>
      }
    >
      <div className="space-y-4">
        <SearchFilters
          query={search}
          status={status}
          onQueryChange={(value) => { setSearch(value); setPage(1); }}
          onStatusChange={(value) => { setStatus(value); setPage(1); }}
          queryPlaceholder="Razón social, NIT o correo"
        />
        {error ? <Toast variant="error" message={error} /> : null}
        <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} loading={loading} emptyState="Aún no hay cuentas comerciales." />
        <Pagination page={page} pageSize={pageSize} totalItems={data.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} loading={loading} />
      </div>

      {editing ? (
        <Modal
          title={editing === "new" ? "Nueva cuenta comercial" : "Editar cuenta comercial"}
          onClose={saving ? undefined : () => setEditing(null)}
          size="xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
              <Button onClick={() => void save()} isLoading={saving}>Guardar</Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Razón social" required value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
            <div className="grid grid-cols-[110px_1fr_70px] gap-2">
              <Select label="Tipo" value={form.taxIdType} disabled={editing !== "new"} onChange={(e) => set("taxIdType", e.target.value as TaxIdType)}>
                <option value="NIT">NIT</option>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PASAPORTE">Pasaporte</option>
              </Select>
              <Input label="Número" required disabled={editing !== "new"} value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
              <Input label="DV" maxLength={1} value={form.dv} onChange={(e) => set("dv", e.target.value)} />
            </div>
            <Input label="Correo de facturación" type="email" required value={form.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} />
            <Input label="Contacto" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
            <Input label="Teléfono (formato internacional)" placeholder="+573001234567" value={form.contactPhoneE164} onChange={(e) => set("contactPhoneE164", e.target.value)} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={form.whatsappOptIn} onChange={(e) => set("whatsappOptIn", e.target.checked)} />
              El cliente autoriza recibir mensajes por WhatsApp
            </label>
            <Input label="Dirección" value={form.address} onChange={(e) => set("address", e.target.value)} />
            <Input label="Ciudad" value={form.city} onChange={(e) => set("city", e.target.value)} />
            {editing !== "new" ? (
              <Select label="Estado" value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
              </Select>
            ) : null}
            <div className="sm:col-span-2">
              <Textarea label="Notas" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          {editing !== "new" ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">La identificación tributaria no se puede cambiar; si es otra, crea una cuenta nueva.</p> : null}
          {formError ? <div className="mt-4"><Toast variant="error" message={formError} /></div> : null}
        </Modal>
      ) : null}

      {detail ? (
        <Modal title={detail.legalName} description={`${detail.taxIdType} ${detail.taxId} · ${detail.billingEmail}`} onClose={() => setDetail(null)} size="xl">
          <div className="space-y-5">
            {notice ? <Toast variant="warning" message={notice} /> : null}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Tenants vinculados</h3>
              <DataTable
                columns={[
                  { key: "tenant", header: "Tenant", render: (link) => link.tenantName ?? link.tenantSlug },
                  { key: "status", header: "Estado", render: (link) => (link.status === "ACTIVE" ? <Pill tone="ok">Activo</Pill> : <Pill tone="muted">Finalizado</Pill>) },
                  { key: "since", header: "Desde", render: (link) => formatDate(link.linkedAt) },
                  { key: "end", header: "Fin / motivo", render: (link) => (link.endedAt ? `${formatDate(link.endedAt)} · ${link.endReason ?? ""}` : "—") },
                  {
                    key: "actions",
                    header: "Acciones",
                    render: (link) =>
                      link.status === "ACTIVE" ? (
                        <Button variant="ghost" size="sm" onClick={() => setUnlinking({ tenantId: link.tenantId, label: link.tenantName ?? link.tenantSlug })}>
                          <Unlink className="mr-1 h-4 w-4" aria-hidden /> Desvincular
                        </Button>
                      ) : null,
                  },
                ]}
                rows={detail.tenants}
                getRowKey={(link) => link.id}
                emptyState="Esta cuenta aún no tiene tenants."
              />
            </section>
            {detail.status === "ACTIVE" ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vincular tenant existente</h3>
                <Input placeholder="Buscar tenant sin cuenta por nombre, slug o NIT" value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} />
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                  {tenantOptions.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No hay tenants sin cuenta que coincidan.</li>
                  ) : (
                    tenantOptions.map((tenant) => (
                      <li key={tenant.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="text-sm text-slate-700 dark:text-slate-200">
                          {tenant.name ?? tenant.slug} <span className="text-xs text-slate-500">· {tenant.activePosTerminals} terminales POS</span>
                        </span>
                        <Button size="sm" variant="outline" onClick={() => void doLink(tenant)}>
                          <Link2 className="mr-1 h-4 w-4" aria-hidden /> Vincular
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <ReasonDialog
        open={unlinking !== null}
        title="Desvincular tenant"
        description={unlinking ? `Se finalizará el vínculo con ${unlinking.label}. Requiere que no tenga contrato abierto.` : undefined}
        confirmText="Desvincular"
        variant="danger"
        onClose={() => setUnlinking(null)}
        onConfirm={async (reason) => {
          if (!detail || !unlinking) return;
          await unlinkTenant(detail.id, unlinking.tenantId, reason);
          await openDetail(detail.id);
          await load();
        }}
      />
    </ControlCenterShell>
  );
};
