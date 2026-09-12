/* eslint-disable @next/next/no-img-element */
import { BarChart3, ChevronRight, LayoutDashboard, Store } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import {
  getMenuItemStateStyles,
  type TenantThemeTokens,
} from "../../../../src/lib/theme/buildTenantTheme";

type BrandingThemePreviewProps = {
  theme: TenantThemeTokens;
  companyName: string;
  logo?: string;
};

const menuItems = [
  { label: "Dashboard", active: false },
  { label: "Configuracion", active: false, isOpen: true, hasActiveChild: true },
  { label: "Branding", active: false, child: true },
  { label: "Menu visual", active: true, child: true, promoteActive: true },
];

export const BrandingThemePreview = ({
  theme,
  companyName,
  logo,
}: BrandingThemePreviewProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Vista previa
      </p>
      <div
        className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700"
        style={{ fontFamily: theme.font }}
      >
        <div
          className="grid min-h-[300px] grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)]"
          style={{ backgroundColor: theme.appBackground }}
        >
          <aside className="border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r dark:bg-slate-800 dark:border-slate-700">
            <div className="mb-4 flex min-w-0 items-center gap-2">
              {logo ? (
                <img
                  src={logo}
                  alt="Logo preview"
                  className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 dark:bg-slate-800 dark:border-slate-700"
                />
              ) : (
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold"
                  style={{
                    backgroundColor: theme.primarySoftBg,
                    color: theme.primary,
                    border: `1px solid ${theme.primaryBorder}`,
                  }}
                >
                  {companyName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {companyName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Manus POS</p>
              </div>
            </div>

            <div
              className="space-y-1 rounded-xl border p-2"
              style={{
                background: `linear-gradient(180deg, ${theme.menu.background}, ${theme.menu.border})`,
                borderColor: theme.menu.border,
                color: theme.menu.text,
              }}
            >
              {menuItems.map((item) => {
                const active = item.active;
                const styles = getMenuItemStateStyles(theme, {
                  depth: item.child ? 1 : 0,
                  isActive: active,
                  isOpen: item.isOpen,
                  hasActiveChild: item.hasActiveChild,
                  promoteActive: item.promoteActive,
                });
                return (
                  <div
                    key={`${item.label}-${item.child ? "child" : "root"}`}
                    className={`relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                      item.child ? "ml-5" : ""
                    }`}
                    style={styles.container}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 inset-y-2 w-0.5 rounded-r-full"
                      style={styles.indicator}
                    />
                    {item.child ? (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full"
                        style={styles.icon}
                      />
                    ) : (
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                        style={styles.icon}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                    {!item.child && active ? (
                      <ChevronRight
                        className="ml-auto h-3 w-3"
                        style={styles.chevron}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Configuracion
                </p>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Branding
                </h4>
              </div>
              <span
                className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: theme.primarySoftBg,
                  borderColor: theme.primaryBorder,
                  color: theme.primary,
                }}
              >
                Activo
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{
                      backgroundColor: theme.primarySoftBg,
                      color: theme.primary,
                    }}
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Hoy
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ventas</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  $1.240.000
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{
                      backgroundColor: theme.secondarySoftBg,
                      color: theme.secondary,
                    }}
                  >
                    <Store className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      borderColor: theme.secondaryBorder,
                      color: theme.secondary,
                    }}
                  >
                    Principal
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sucursal</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  Centro
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                style={{
                  backgroundColor: theme.primary,
                  color: theme.primaryText,
                }}
              >
                Guardar
              </Button>
              <Button
                size="sm"
                variant="outline"
                style={{
                  borderColor: theme.secondaryBorder,
                  color: theme.secondary,
                }}
              >
                Revisar
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
