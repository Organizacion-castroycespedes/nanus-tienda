"use client";

import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { Button } from "../../components/design-system/Button";
import { Modal } from "../../components/design-system/Modal";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { login, replaceActiveSession } from "../../domains/auth/api";
import { decodeTokenPayload } from "../../domains/auth/jwt";
import { isQaLoginEnabled } from "../../domains/auth/login-qa";
import { startSessionFromLogin } from "../../domains/auth/session-manager";
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
    if (isSubmitting) {
      return;
    }
    if (!email.trim() || !password.trim()) {
      setStatusWarning("Ingresa tu email y Contraseña.");
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
        dispatch(setAuthStatus("anonymous"));
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
      dispatch(setAuthStatus("anonymous"));
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
      dispatch(setAuthStatus("anonymous"));
      setStatusError("No fue posible iniciar sesion. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, pendingCredentials, rememberMe, router, setStatusError, setStatusSuccess]);

  const handleCancelForceLogin = useCallback(() => {
    setShowSessionConflict(false);
    setPendingCredentials(null);
    dispatch(setAuthStatus("anonymous"));
    setStatusWarning("Inicio de sesion cancelado.");
  }, [dispatch, setStatusWarning]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none opacity-35">
        <Image
          src="/logo-login.png"
          alt="EMAUS POS"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain object-center"
        />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:justify-end lg:px-[5vw] lg:py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-sm sm:p-9 lg:mr-0 lg:w-[30vw] lg:max-w-[31rem] lg:p-11 dark:border-slate-700/70 dark:bg-slate-900/95">
          {showSessionConflict ? (
            <Modal title="Sesion activa detectada" onClose={handleCancelForceLogin}>
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700 dark:text-cyan-300">
                  EMAUS POS
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Centro de Soluciones
                </p>
                <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Bienvenido
                </h1>
                <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
                  Ingresa a tu cuenta para continuar.
                </p>
              </div>
              <span className="pt-1 text-xs font-medium text-slate-400">
                v{appVersion.replace(/^v/, "")}
              </span>
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

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoFocus
                  ref={emailInputRef}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@tuempresa.com"
                  required
                  className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[&:-webkit-autofill]:bg-slate-800 dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] dark:[&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#1e293b_inset]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-12 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[&:-webkit-autofill]:bg-slate-800 dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white] dark:[&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#1e293b_inset]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 min-h-10 min-w-10 -translate-y-1/2 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
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
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                />
                Recordarme
              </label>
            </div>


            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-14 w-full justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-base shadow-lg shadow-blue-600/20 hover:from-blue-800 hover:via-blue-700 hover:to-cyan-600 focus-visible:ring-4 focus-visible:ring-blue-600/25"
            >
              {isSubmitting ? (
                <>
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </>
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
