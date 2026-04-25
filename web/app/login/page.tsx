"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/design-system/Button";
import { Input } from "../../components/design-system/Input";
import { Modal } from "../../components/design-system/Modal";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { forceLogin, login } from "../../domains/auth/api";
import { decodeTokenPayload } from "../../domains/auth/jwt";
import {
  startSessionFromLogin,
} from "../../domains/auth/session-manager";
import { hasRefreshTokenStorage } from "../../domains/auth/session";
import { ApiError } from "../../lib/request";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAuthStatus } from "../../store/authSlice";

const LoginPageContent = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isHuman, setIsHuman] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [status, setStatus] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const tenantId = useAppSelector((state) => state.auth.tenantId);
  useAutoClearState(status, setStatus, 12000);

  const setStatusMessage = (message: string, variant: ToastVariant) => {
    setStatus({ message, variant });
  };
  const setStatusSuccess = (message: string) =>
    setStatusMessage(message, "success");
  const setStatusError = (message: string) => setStatusMessage(message, "error");
  const setStatusWarning = (message: string) =>
    setStatusMessage(message, "warning");

  useEffect(() => {
    if (status) {
      return;
    }
    if (searchParams?.get("reason") === "session-ended") {
      setStatusWarning(
        "Tu sesión expiró o fue cerrada en otro dispositivo. Inicia sesión nuevamente."
      );
    }
  }, [searchParams, status]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    const targetTenant = tenantId ?? "default";
    setStatusWarning("Ya existe una sesión activa en este navegador.");
    router.replace(`/${targetTenant}/dashboard`);
  }, [authStatus, router, tenantId]);

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
    setHasSubmitted(true);
    if (!email.trim() || !password.trim()) {
      setStatusWarning("Ingresa tu email y contraseña.");
      return;
    }
    if (!isHuman) {
      setStatusWarning("Confirma el reCAPTCHA antes de continuar.");
      return;
    }
    if (authStatus === "authenticated") {
      setStatusWarning("Ya existe una sesión activa en este navegador.");
      return;
    }
    if (authStatus === "authenticating" || authStatus === "refreshing") {
      setStatusWarning("Estamos procesando otra autenticación. Intenta de nuevo.");
      return;
    }
    setStatus(null);
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await login({ email, password });
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const tenantSlug = tokenPayload?.tenant_id ?? "default";
      await startSessionFromLogin(tokens, {
        fallbackEmail: email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setStatusSuccess("Inicio de sesión exitoso. Redirigiendo...");
      router.push(`/${tenantSlug}/dashboard`);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.status === 409 &&
        (!requestError.code || requestError.code === "SESSION_ACTIVE")
      ) {
        setPendingCredentials({ email, password });
        setShowSessionConflict(true);
        setStatusWarning(
          "Ya existe una sesión activa. Puedes cerrarla y continuar aquí."
        );
        return;
      }
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesión. Revisa tus credenciales.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceLogin = useCallback(async () => {
    if (!pendingCredentials) {
      setShowSessionConflict(false);
      return;
    }
    setIsSubmitting(true);
    dispatch(setAuthStatus("authenticating"));
    try {
      const tokens = await forceLogin(pendingCredentials);
      const tokenPayload = decodeTokenPayload(tokens.accessToken);
      const tenantSlug = tokenPayload?.tenant_id ?? "default";
      await startSessionFromLogin(tokens, {
        fallbackEmail: pendingCredentials.email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setShowSessionConflict(false);
      setPendingCredentials(null);
      setStatusSuccess("Sesión anterior cerrada. Redirigiendo...");
      router.push(`/${tenantSlug}/dashboard`);
    } catch {
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesión. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, pendingCredentials, rememberMe, router]);

  const handleCancelForceLogin = useCallback(() => {
    setShowSessionConflict(false);
    setPendingCredentials(null);
    setStatusWarning("Inicio de sesión cancelado.");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {showSessionConflict ? (
          <Modal title="Sesión activa detectada">
            <p className="text-sm text-slate-600">
              Ya existe una sesión activa en otro dispositivo o navegador. Si
              continúas aquí, la sesión anterior se cerrará automáticamente.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handleForceLogin} disabled={isSubmitting}>
                {isSubmitting ? "Procesando..." : "Cerrar la otra sesión"}
              </Button>
              <Button variant="outline" onClick={handleCancelForceLogin}>
                Cancelar
              </Button>
            </div>
          </Modal>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            Iniciar sesión
          </h1>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Volver al inicio
          </Link>
        </div>
        {status ? (
          <div className="mt-4">
            <Toast
              message={status.message}
              variant={status.variant}
              onClose={() => setStatus(null)}
            />
          </div>
        ) : null}
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@empresa.com"
            required
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            required
          />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Recordarme
            </label>
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isHuman}
              onChange={(event) => setIsHuman(event.target.checked)}
            />
            No soy un robot
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
          {hasSubmitted && !isHuman ? (
            <p className="text-xs text-red-500">
              Debes completar el reCAPTCHA antes de continuar.
            </p>
          ) : null}
        </form>
        <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-200" />
          <span>O inicia con</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="mt-4 grid gap-3">
          <Button variant="outline" onClick={() => handleSocialLogin("google")}>
            Continuar con Google
          </Button>
          <Button variant="outline" onClick={() => handleSocialLogin("facebook")}>
            Continuar con Facebook
          </Button>
        </div>
      </section>
    </main>
  );
};

const LoginPage = () => {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <p className="text-sm text-slate-500">Cargando acceso...</p>
          </section>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
