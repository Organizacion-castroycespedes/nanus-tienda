"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../../components/design-system/Button";
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
  const [showPassword, setShowPassword] = useState(false);
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
        "Tu sesion expiro o fue cerrada en otro dispositivo. Inicia sesion nuevamente."
      );
    }
  }, [searchParams, status]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    const targetTenant = tenantId ?? "default";
    setStatusWarning("Ya existe una sesion activa en este navegador.");
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
      setStatusWarning("Ingresa tu email y contrasena.");
      return;
    }
    if (!isHuman) {
      setStatusWarning("Confirma el reCAPTCHA antes de continuar.");
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
      const tenantSlug = tokenPayload?.tenant_id ?? "default";
      await startSessionFromLogin(tokens, {
        fallbackEmail: email,
        persistRefresh: rememberMe && hasRefreshTokenStorage(),
      });
      setStatusSuccess("Inicio de sesion exitoso. Redirigiendo...");
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
      setStatusSuccess("Sesion anterior cerrada. Redirigiendo...");
      router.push(`/${tenantSlug}/dashboard`);
    } catch {
      dispatch(setAuthStatus("error"));
      setStatusError("No fue posible iniciar sesion. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, pendingCredentials, rememberMe, router]);

  const handleCancelForceLogin = useCallback(() => {
    setShowSessionConflict(false);
    setPendingCredentials(null);
    setStatusWarning("Inicio de sesion cancelado.");
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left panel — branding (hidden on mobile) */}
        <div
          className="relative hidden flex-col justify-between p-10 lg:flex lg:w-5/12 xl:w-1/2"
          style={{
            backgroundImage: `
              linear-gradient(0deg, rgba(15, 23, 42, 0.3), rgba(15, 23, 42, 0.3)),
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

        {/* Logo */}
        <Link href="/" className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LogoManus.png-AQn35KrUXzECzcI6dhjsq3tPKsUTFa.jpeg"
            alt="Manus POS"
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Central copy */}
        <div className="relative z-10">
          <blockquote className="text-xl font-medium leading-relaxed text-white">
            &ldquo;Manus nos cambio la vida. Antes tardabamos horas en cuadrar caja.
            Ahora lo hacemos en minutos.&rdquo;
          </blockquote>
          <footer className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              MG
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Maria Gonzalez</p>
              <p className="text-xs text-slate-400">Duena de minimarket</p>
            </div>
          </footer>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: "500+", label: "Negocios" },
            { value: "1.2M+", label: "Ventas" },
            { value: "99.9%", label: "Uptime" },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-xl border border-white/10 p-4 text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="mb-8 inline-flex lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LogoManus.png-AQn35KrUXzECzcI6dhjsq3tPKsUTFa.jpeg"
              alt="Manus POS"
              className="h-10 w-auto object-contain"
            />
          </Link>

          {showSessionConflict ? (
            <Modal title="Sesion activa detectada">
              <p className="text-sm text-slate-600">
                Ya existe una sesion activa en otro dispositivo o navegador. Si
                continuas aqui, la sesion anterior se cerrara automaticamente.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={handleForceLogin} disabled={isSubmitting}>
                  {isSubmitting ? "Procesando..." : "Cerrar la otra sesion"}
                </Button>
                <Button variant="outline" onClick={handleCancelForceLogin}>
                  Cancelar
                </Button>
              </div>
            </Modal>
          ) : null}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido de vuelta</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa tus credenciales para acceder a tu cuenta.
            </p>
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
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Contrasena
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 transition hover:text-blue-700 hover:underline"
                >
                  Olvidaste tu contrasena?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
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
              <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Recordarme
              </label>
            </div>

            {/* CAPTCHA */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isHuman}
                onChange={(e) => setIsHuman(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600"
              />
              No soy un robot
            </label>
            {hasSubmitted && !isHuman ? (
              <p className="text-xs text-red-500">
                Debes confirmar que no eres un robot.
              </p>
            ) : null}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center rounded-xl py-2.5"
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

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">O continua con</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Social login */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-center rounded-xl py-2.5"
              onClick={() => handleSocialLogin("google")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center rounded-xl py-2.5"
              onClick={() => handleSocialLogin("facebook")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continuar con Facebook
            </Button>
          </div>

          {/* Create account */}
          <p className="mt-8 text-center text-sm text-slate-500">
            No tienes cuenta?{" "}
            <Link
              href="/"
              className="font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
            >
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

const LoginPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
            <p className="text-sm text-slate-500">Cargando acceso...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
