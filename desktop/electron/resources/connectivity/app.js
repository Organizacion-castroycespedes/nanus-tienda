const states = {
  startup: { status: "Conectando", title: "Iniciando Manus POS", lead: "Estamos conectando tu terminal al servicio.", secondary: "Esto puede tardar unos segundos.", connection: "Conectando con el servicio", detail: "Preparando la conexión...", badge: "Conectando", footnote: "No cierres la aplicación mientras se completa el inicio.", icon: "◔", actions: false },
  offline: { status: "Sin conexión", title: "Se perdió la conexión con Manus POS", lead: "No pudimos mantener la conexión con el servicio en línea.", secondary: "Estamos intentando recuperar la comunicación.", connection: "Sin conexión con el servicio", detail: "Se volverá a intentar automáticamente.", badge: "Sin conexión", footnote: "Manus POS sigue siendo un cliente en línea. No se guardan ventas offline.", icon: "⚠", actions: true },
  reconnecting: { status: "Reconectando", title: "Reconectando con Manus POS", lead: "Estamos verificando nuevamente el servicio.", secondary: "No necesitas cerrar la aplicación.", connection: "Reintentando en unos segundos", detail: "Restauraremos la última pantalla válida cuando responda el servicio.", badge: "Reconectando", footnote: "La aplicación controla un único ciclo de reconexión.", icon: "↻", actions: true },
  restored: { status: "En línea", title: "Conexión restablecida", lead: "Manus POS volvió a estar disponible.", secondary: "Regresando a la última pantalla válida.", connection: "Servicio disponible", detail: "Cargando la última pantalla válida...", badge: "En línea", footnote: "Volviendo a la aplicación web.", icon: "✓", actions: false },
};

const setState = (name) => {
  const state = states[name] || states.startup;
  document.body.dataset.state = name;
  document.querySelector("#statusText").textContent = state.status;
  document.querySelector("#title").textContent = state.title;
  document.querySelector("#lead").textContent = state.lead;
  document.querySelector("#secondary").textContent = state.secondary;
  document.querySelector("#connectionTitle").textContent = state.connection;
  document.querySelector("#connectionDetail").textContent = state.detail;
  document.querySelector("#badge").textContent = state.badge;
  document.querySelector("#footnote").textContent = state.footnote;
  document.querySelector("#signal").textContent = state.icon;
  document.querySelector("#actions").hidden = !state.actions;
};

document.querySelector("#retryButton").addEventListener("click", () => {
  setState("reconnecting");
  window.manusTerminal?.retryConnection();
});

setState(new URLSearchParams(window.location.search).get("state") || "startup");
