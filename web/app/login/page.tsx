"use client";

import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../../components/design-system/Button";
import { Modal } from "../../components/design-system/Modal";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { login, replaceActiveSession } from "../../domains/auth/api";
import { decodeTokenPayload } from "../../domains/auth/jwt";
import { isQaLoginEnabled } from "../../domains/auth/login-qa";
import {
  startSessionFromLogin,
} from "../../domains/auth/session-manager";
import { resolveTenantSlug } from "../../domains/auth/tenant-path";
import { hasRefreshTokenStorage } from "../../domains/auth/session";
import { ApiError } from "../../lib/request";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAuthStatus } from "../../store/authSlice";

const LoginPageContent = () => {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [qaLoginEnabled, setQaLoginEnabled] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  const tenantSlug = useAppSelector((state) => state.auth.tenantSlug);
  const emailInputRef = useRef<HTMLInputElement>(null);
  useAutoClearState(status, setStatus, 12000);

  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    setQaLoginEnabled(
      isQaLoginEnabled(
        window.location.hostname,
        process.env.NEXT_PUBLIC_QA_LOGIN_ENABLED
      )
    );
  }, []);


  const setStatusMessage = useCallback((message: string, variant: ToastVariant) => {
    setStatus({ message, variant });
  }, []);
  const setStatusSuccess = useCallback((message: string) => setStatusMessage(message, "success"), [setStatusMessage]);
  const setStatusError = useCallback((message: string) => setStatusMessage(message, "error"), [setStatusMessage]);
  const setStatusWarning = useCallback((message: string) => setStatusMessage(message, "warning"), [setStatusMessage]);

  useEffect(() => {
    if (status) {
      return;
    }
    if (searchParams?.get("reason") === "session-ended") {
      setStatusWarning(
        "Tu sesion expiro o fue cerrada en otro dispositivo. Inicia sesion nuevamente."
      );
    }
  }, [searchParams, status, setStatusWarning]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    const targetTenant = resolveTenantSlug({ tenantSlug, tenantId });
    setStatusWarning("Ya existe una sesion activa en este navegador.");
    router.replace(`/${targetTenant}/dashboard`);
  }, [authStatus, router, tenantId, tenantSlug, setStatusWarning]);

  const handleSocialLogin = (provider: "google" | "facebook") => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    const target = baseUrl ? `${baseUrl}/auth/${provider}` : `/auth/${provider}`;
    setStatusSuccess(
      `Redirigiendo a ${provider === "google" ? "Google" : "Facebook"}...`
    );
    window.location.href = target;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatusWarning("Ingresa tu email y Contraseña.");
      return;
    }
    if (authStatus === "authenticated") {
      setStatusWarning("Ya existe una sesion activa en este navegador.");
      return;
    }
    if (authStatus === "authenticating" || authStatus === "refreshing") {
      setStatusWarning("Estamos procesando otra autenticacion. Intenta de nuevo.");
      return;
    }
    setStatus(null);
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await login({ email, password });
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const nextTenantId = tokenPayload?.tenant_id ?? "default";
      const nextTenantSlug = resolveTenantSlug({
        tenantSlug: tokenPayload?.tenant_slug,
        tenantId: nextTenantId,
      });
      await startSessionFromLogin(tokens, {
        fallbackEmail: email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setStatusSuccess("Inicio de sesion exitoso. Redirigiendo...");
      router.push(`/${nextTenantSlug}/dashboard`);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.status === 409 &&
        (!requestError.code || requestError.code === "SESSION_ACTIVE")
      ) {
        setPendingCredentials({ email, password });
        setShowSessionConflict(true);
        setStatusWarning(
          "Ya existe una sesion activa. Puedes cerrarla y continuar aqui."
        );
        return;
      }
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesion. Revisa tus credenciales.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplaceSession = useCallback(async () => {
    if (!pendingCredentials) {
      setShowSessionConflict(false);
      return;
    }
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await replaceActiveSession(pendingCredentials);
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const nextTenantId = tokenPayload?.tenant_id ?? "default";
      const nextTenantSlug = resolveTenantSlug({
        tenantSlug: tokenPayload?.tenant_slug,
        tenantId: nextTenantId,
      });
      await startSessionFromLogin(tokens, {
        fallbackEmail: pendingCredentials.email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setShowSessionConflict(false);
      setPendingCredentials(null);
      setStatusSuccess("Sesion anterior cerrada. Redirigiendo...");
      router.push(`/${nextTenantSlug}/dashboard`);
    } catch {
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesion. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, pendingCredentials, rememberMe, router, setStatusError, setStatusSuccess]);

  const handleCancelForceLogin = useCallback(() => {
    setShowSessionConflict(false);
    setPendingCredentials(null);
    setStatusWarning("Inicio de sesion cancelado.");
  }, [setStatusWarning]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="relative hidden flex-col justify-between p-10 lg:flex lg:w-[55%]"
        style={{
          backgroundImage: `
              linear-gradient(0deg, rgba(15, 23, 42, 0.62), rgba(15, 23, 42, 0.62)),
              url('/login-bg.jpg'),
              linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.06) 50%, rgba(30, 27, 75, 0.08) 100%),
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 80px,
              rgba(59, 130, 246, 0.04) 80px,
              rgba(59, 130, 246, 0.04) 160px
            ),
              radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)
            `,
          backgroundColor: '#0f172a',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-slate-900/45" />

      </div>
      {/* Right panel — form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">


          {showSessionConflict ? (
            <Modal title="Sesion activa detectada">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ya existe una sesion activa en otro dispositivo o navegador. Si
                continuas aqui, la sesion anterior se cerrara automaticamente.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={handleReplaceSession} disabled={isSubmitting}>
                  {isSubmitting ? "Procesando..." : "Cerrar sesion anterior"}
                </Button>
                <Button variant="outline" onClick={handleCancelForceLogin}>
                  Cancelar
                </Button>
              </div>
            </Modal>
          ) : null}

          <div className="mb-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Manus POS</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Bienvenido</h1>
              </div>
              <span className="text-xs text-slate-400">v{appVersion.replace(/^v/, "")}</span>
            </div>
          </div>

          {status ? (
            <div className="mb-5">
              <Toast
                message={status.message}
                variant={status.variant}
                onClose={() => setStatus(null)}
              />
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoFocus
                ref={emailInputRef}
                tabIndex={1}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:[&:-webkit-autofill]:bg-slate-800 dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] dark:[&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#1e293b_inset]"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  tabIndex={3}
                  className="text-xs text-blue-600 transition hover:text-blue-700 hover:underline"
                >
                  Olvidaste tu Contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  tabIndex={2}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:[&:-webkit-autofill]:bg-slate-800 dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] dark:[&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#1e293b_inset]"
                />
                <button
                  type="button"
                  tabIndex={4}
                  aria-label={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Options row */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  tabIndex={5}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Recordarme
              </label>
            </div>


            {/* Submit */}
            <Button
              type="submit"
              tabIndex={7}
              disabled={isSubmitting}
              className="min-h-[52px] w-full justify-center rounded-xl text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

const LoginPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando acceso...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
