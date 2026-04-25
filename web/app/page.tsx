import Link from "next/link";
import { Button } from "../components/design-system/Button";

const HomePage = () => {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">
          Soft Tenantcore Platform
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Plataforma multi-tenant para gestión integral.
        </p>
        <Link href="/login">
          <Button variant="primary" className="mt-6">
            Iniciar sesión
          </Button>
        </Link>
      </section>
    </main>
  );
};

export default HomePage;
