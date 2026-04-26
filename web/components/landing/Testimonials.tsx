const testimonials = [
  {
    quote:
      "Manus nos cambio la vida. Antes tardabamos horas en cuadrar caja. Ahora lo hacemos en minutos.",
    name: "Maria Gonzalez",
    role: "Duena de minimarket",
    initials: "MG",
    color: "bg-blue-600",
  },
  {
    quote:
      "Tener el inventario actualizado en tiempo real evito que vendieramos productos que ya no teniamos.",
    name: "Carlos Reyes",
    role: "Emprendedor, tienda de ropa",
    initials: "CR",
    color: "bg-emerald-600",
  },
  {
    quote:
      "Por fin puedo saber cuanto gano al dia sin hacer cuentas a mano. El dashboard lo dice todo.",
    name: "Ana Jimenez",
    role: "Propietaria, ferreteria",
    initials: "AJ",
    color: "bg-amber-600",
  },
];

const stats = [
  { value: "500+", label: "Negocios activos" },
  { value: "1.2M+", label: "Ventas procesadas" },
  { value: "99.9%", label: "Uptime garantizado" },
  { value: "4.9/5", label: "Satisfaccion de usuarios" },
];

const Testimonials = () => (
  <section className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      {/* Stats */}
      <div className="mb-16 grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-3xl font-bold text-slate-900 md:text-4xl">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      {/* Testimonials */}
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
          Testimonios
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          Lo que dicen nuestros usuarios
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map(({ quote, name, role, initials, color }) => (
          <blockquote
            key={name}
            className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-sm"
          >
            <p className="text-sm leading-relaxed text-slate-700">
              &ldquo;{quote}&rdquo;
            </p>
            <footer className="mt-6 flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}
              >
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">{role}</p>
              </div>
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
