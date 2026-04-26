import Link from "next/link";

const UnauthorizedPage = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">
          Unauthorized
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">
          No tienes permiso para acceder a esta ruta.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Tu sesión está activa, pero este recurso no está habilitado para tu rol o permisos actuales.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
};

export default UnauthorizedPage;
