"use client";

import { useState } from "react";
import { Button } from "../../components/design-system/Button";
import { Input } from "../../components/design-system/Input";
import { forgotPassword } from "../../domains/auth/api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }
    setError(null);
    try {
      await forgotPassword({ email });
      setSubmitted(true);
    } catch (requestError) {
      setError("No fue posible enviar el correo de recuperación.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Recuperar contraseña
        </h1>
        {submitted ? (
          <p className="mt-4 text-sm text-slate-600">
            Si el email existe, recibirás un enlace de recuperación.
          </p>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" variant="primary">
              Enviar enlace
            </Button>
          </form>
        )}
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
