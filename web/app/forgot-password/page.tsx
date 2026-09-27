"use client";
 
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { Button } from "../../components/design-system/Button";
import { forgotPassword } from "../../domains/auth/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Por favor ingresa tu correo electrónico.");
      emailInputRef.current?.focus();
      return;
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError("El formato del correo electrónico no es válido.");
      emailInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword({ email: cleanEmail });
      setSubmitted(true);
    } catch (requestError) {
      setError("No fue posible procesar la solicitud. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-8 shadow-2xl backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/95 sm:p-10">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a inicio de sesión
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ingresa tu correo asociado para enviarte las instrucciones de restablecimiento.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm">
                <p className="font-semibold">Solicitud enviada</p>
                <p className="mt-1">
                  Si <strong>{email}</strong> está registrado en el sistema, recibirás un enlace de recuperación.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                  setTimeout(() => emailInputRef.current?.focus(), 50);
                }}
              >
                Enviar a otro correo
              </Button>
              <Link
                href="/login"
                className="text-center text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Regresar al login
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  ref={emailInputRef}
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="usuario@tuempresa.com"
                  required
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {error ? (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-sm font-medium shadow-lg shadow-blue-600/20 hover:from-blue-800 hover:via-blue-700 hover:to-cyan-600 focus-visible:ring-4 focus-visible:ring-blue-600/25 disabled:opacity-50"
            >
              {isSubmitting ? "Enviando enlace..." : "Enviar enlace"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
};

export default ForgotPasswordPage;

