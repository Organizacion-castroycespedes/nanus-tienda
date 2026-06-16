const CHROME_PORT = Number(process.env.QA_CHROME_PORT ?? "9223");
const BASE_URL = process.env.QA_WEB_BASE_URL ?? "http://localhost:3001";
const API_BASE_URL =
  process.env.QA_API_BASE_URL ?? "http://localhost:4020/api";
const TENANT_ID = process.env.QA_TENANT_ID;
const PASSWORD = process.env.QA_DEMO_PASSWORD;
const SUPER_ADMIN_PASSWORD = process.env.QA_SUPER_ADMIN_PASSWORD;
const USER_EMAIL = process.env.QA_USER_EMAIL;
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL;
const SUPER_USER_EMAIL = process.env.QA_SUPER_USER_EMAIL;
const SUPER_ADMIN_EMAIL = process.env.QA_SUPER_ADMIN_EMAIL;
const RUN_ONLY_ROLE = process.env.QA_ROLE?.trim().toUpperCase();

const allRoles = [
  {
    role: "SUPER_USER",
    email: SUPER_USER_EMAIL,
    password: PASSWORD,
  },
  {
    role: "USER",
    email: USER_EMAIL,
    password: PASSWORD,
  },
  {
    role: "ADMIN",
    email: ADMIN_EMAIL,
    password: PASSWORD,
  },
  {
    role: "SUPER_ADMIN",
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  },
].filter((role) => Boolean(role.email && role.password));

const roles = RUN_ONLY_ROLE
  ? allRoles.filter((role) => role.role === RUN_ONLY_ROLE)
  : allRoles;

if (!TENANT_ID || !roles.length) {
  throw new Error(
    "No QA tenant/roles configured. Set QA_TENANT_ID, QA_USER_EMAIL, QA_ADMIN_EMAIL, QA_SUPER_USER_EMAIL, QA_DEMO_PASSWORD and, for SUPER_ADMIN, QA_SUPER_ADMIN_EMAIL plus QA_SUPER_ADMIN_PASSWORD."
  );
}

class CdpPage {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.logEntries = [];
    this.downloads = [];
    this.popupTargets = [];
    this.requestUrls = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
        return;
      }
      if (message.method) {
        if (message.method === "Network.requestWillBeSent") {
          const requestId = message.params?.requestId;
          const url = message.params?.request?.url;
          if (requestId && url) {
            this.requestUrls.set(requestId, url);
          }
        }
        if (message.method === "Network.responseReceived") {
          const response = message.params?.response;
          if (
            response?.url?.includes("/api/") ||
            response?.url?.startsWith("blob:") ||
            Number(response?.status ?? 0) >= 400
          ) {
            this.logEntries.push({
              type: "network-response",
              status: response.status,
              mimeType: response.mimeType,
              url: response.url,
            });
          }
        }
        if (message.method === "Network.loadingFailed") {
          this.logEntries.push({
            type: "network-failed",
            url: this.requestUrls.get(message.params?.requestId),
            errorText: message.params?.errorText,
            blockedReason: message.params?.blockedReason,
          });
        }
        if (message.method === "Page.downloadWillBegin") {
          this.downloads.push({
            url: message.params?.url,
            suggestedFilename: message.params?.suggestedFilename,
          });
        }
        if (message.method === "Page.windowOpen") {
          this.popupTargets.push({
            url: message.params?.url,
            windowName: message.params?.windowName,
          });
        }
        const listeners = this.events.get(message.method) ?? [];
        for (const listener of listeners) {
          listener(message.params ?? {});
        }
      }
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
    await this.send("Log.enable");
    await this.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: `${process.cwd()}\\docs`,
    }).catch(() => null);
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await this.send("Page.bringToFront").catch(() => null);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  waitEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Event timeout: ${method}`));
      }, timeoutMs);
      const listener = (params) => {
        clearTimeout(timeout);
        this.events.set(
          method,
          (this.events.get(method) ?? []).filter((item) => item !== listener)
        );
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) ?? []), listener]);
    });
  }

  async goto(url) {
    const loadPromise = this.waitEvent("Page.loadEventFired", 20000).catch(
      () => null
    );
    await this.send("Page.navigate", { url });
    await loadPromise;
    await this.wait(900);
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "Runtime eval failed");
    }
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = await this.eval(expression).catch(() => false);
      if (value) {
        return value;
      }
      await this.wait(300);
    }
    return false;
  }

  async wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async clickSelector(selector) {
    const rect = await this.eval(`
      (() => {
        const element = document.querySelector(${jsString(selector)});
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      })()
    `);
    if (!rect || rect.width === 0 || rect.height === 0) {
      return false;
    }
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.x,
      y: rect.y,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: rect.x,
      y: rect.y,
      button: "left",
      clickCount: 1,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: rect.x,
      y: rect.y,
      button: "left",
      clickCount: 1,
    });
    return true;
  }

  async fillSelector(selector, value) {
    const focused = await this.eval(`
      (() => {
        const element = document.querySelector(${jsString(selector)});
        if (!element) return false;
        element.focus();
        element.select?.();
        return true;
      })()
    `);
    if (!focused) {
      return false;
    }
    await this.send("Input.insertText", { text: value });
    return true;
  }

  async screenshot(path) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    });
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(path, Buffer.from(result.data, "base64"))
    );
  }

  close() {
    this.ws?.close();
  }
}

const jsString = (value) => JSON.stringify(value);

const jsonFetch = async (path, options = {}) => {
  const response = await fetch(`http://localhost:${CHROME_PORT}${path}`, options);
  if (!response.ok) {
    throw new Error(`${path} ${response.status}`);
  }
  return response.json();
};

const createPage = async () => {
  const target = await jsonFetch(`/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.connect();
  return page;
};

const visibleTextScript = `
(() => {
  const text = document.body?.innerText ?? "";
  return text.replace(/\\s+/g, " ").trim();
})()
`;

const sanitizeUrlScript = `
(() => {
  const url = new URL(location.href);
  if (url.searchParams.has("password")) {
    url.searchParams.set("password", "***");
  }
  return url.toString();
})()
`;

const clearBrowserStateScript = `
(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  return true;
})()
`;

const setReactValueScript = (selector, value) => `
(() => {
  const element = document.querySelector(${jsString(selector)});
  if (!element) return false;
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, ${jsString(value)});
  } else {
    element.value = ${jsString(value)};
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()
`;

const clickByTextScript = (text, selector = "button,a", preferLast = false) => `
(() => {
  const target = ${jsString(text)};
  const candidates = Array.from(document.querySelectorAll(${jsString(selector)}))
    .filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        !item.disabled &&
        (item.innerText || item.textContent || "").trim().includes(target);
    });
  const element = ${preferLast ? "candidates.at(-1)" : "candidates[0]"};
  if (!element) return false;
  element.click();
  return true;
})()
`;

const setLabeledValueScript = (labelText, value) => `
(() => {
  const target = ${jsString(labelText)}.toLowerCase();
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) =>
    (item.innerText || item.textContent || "").toLowerCase().includes(target)
  );
  const element = label?.querySelector("input, textarea, select");
  if (!element) return false;
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, ${jsString(value)});
  } else {
    element.value = ${jsString(value)};
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()
`;

const selectFirstOptionByLabelScript = (labelText, preferredText = "") => `
(() => {
  const target = ${jsString(labelText)}.toLowerCase();
  const preferred = ${jsString(preferredText)}.toLowerCase();
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) =>
    (item.innerText || item.textContent || "").toLowerCase().includes(target)
  );
  const select = label?.querySelector("select");
  if (!select || select.disabled) return { changed: false, disabled: Boolean(select?.disabled), value: select?.value ?? null };
  const options = Array.from(select.options).filter((item) => item.value && !item.disabled);
  const option =
    (preferred ? options.find((item) => item.text.toLowerCase().includes(preferred)) : null) ??
    options[0];
  if (!option) return { changed: false, disabled: false, value: select.value };
  const proto = Object.getPrototypeOf(select);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) {
    descriptor.set.call(select, option.value);
  } else {
    select.value = option.value;
  }
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return { changed: true, disabled: false, value: option.value, text: option.text };
})()
`;

const selectInfoScript = `
(() => Array.from(document.querySelectorAll("label")).map((label) => {
  const select = label.querySelector("select");
  if (!select) return null;
  return {
    label: (label.innerText || "").replace(/\\s+/g, " ").trim(),
    disabled: select.disabled,
    value: select.value,
    options: Array.from(select.options).map((option) => ({
      value: option.value,
      text: option.text,
      disabled: option.disabled,
    })),
  };
}).filter(Boolean))()
`;

const firstEnabledProductClickScript = `
(() => {
  const buttons = Array.from(document.querySelectorAll("button"))
    .filter((button) => {
      const text = (button.innerText || button.textContent || "").replace(/\\s+/g, " ");
      const normalizedText = text.toLowerCase();
      const rect = button.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        !button.disabled &&
        normalizedText.includes("precio final") &&
        normalizedText.includes("+1 al carrito");
    });
  const button = buttons[0];
  if (!button) return { clicked: false, count: buttons.length };
  const text = (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim();
  button.click();
  return { clicked: true, text };
})()
`;

const ensurePaymentModalReadyScript = `
(() => {
  const modal = Array.from(document.querySelectorAll(".fixed.inset-0"))
    .find((item) => (item.innerText || "").includes("Cobrar venta"));
  if (!modal) return { hasModal: false };

  const cobrarButtonText = Array.from(document.querySelectorAll("button"))
    .map((button) => (button.innerText || "").replace(/\\s+/g, " ").trim())
    .find((text) => text.startsWith("COBRAR "));
  const totalText =
    Array.from(modal.querySelectorAll("p,span,div"))
      .map((item) => (item.innerText || item.textContent || "").replace(/\\s+/g, " ").trim())
      .find((text) => text.includes("$")) ?? cobrarButtonText ?? "";
  const normalize = (text) => {
    const clean = String(text)
      .replace(/[^0-9,.-]/g, "")
      .replace(/\\.(?=\\d{3}(\\D|$))/g, "")
      .replace(",", ".");
    const value = Number(clean);
    return Number.isFinite(value) && value > 0 ? String(value) : "";
  };
  const amount = normalize(totalText);

  const methodSelect = modal.querySelector("select");
  if (methodSelect && !methodSelect.value) {
    const option = Array.from(methodSelect.options).find((item) => item.value && !item.disabled);
    if (option) {
      const proto = Object.getPrototypeOf(methodSelect);
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor?.set) descriptor.set.call(methodSelect, option.value);
      else methodSelect.value = option.value;
      methodSelect.dispatchEvent(new Event("input", { bubbles: true }));
      methodSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  const labels = Array.from(modal.querySelectorAll("label"));
  const amountLabel = labels.find((label) =>
    (label.innerText || label.textContent || "").toLowerCase().includes("monto")
  );
  const amountInput = amountLabel?.querySelector("input");
  if (amountInput && amount && (!amountInput.value || Number(amountInput.value) <= 0)) {
    const proto = Object.getPrototypeOf(amountInput);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set) descriptor.set.call(amountInput, amount);
    else amountInput.value = amount;
    amountInput.dispatchEvent(new Event("input", { bubbles: true }));
    amountInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return {
    hasModal: true,
    amount,
    methodSelected: Boolean(methodSelect?.value),
    amountValue: amountInput?.value ?? null,
  };
})()
`;

const clickFirstTicketActionScript = (text) => `
(() => {
  const target = ${jsString(text)};
  const buttons = Array.from(document.querySelectorAll("button"))
    .filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        !button.disabled &&
        (button.innerText || button.textContent || "").trim().includes(target);
    });
  const button = buttons[0];
  if (!button) return false;
  button.click();
  return true;
})()
`;

const loginFormStateScript = `
(() => {
  const form = document.querySelector("form");
  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const submit = form?.querySelector('button[type="submit"]');
  return {
    hasForm: Boolean(form),
    hasEmail: Boolean(email),
    hasPassword: Boolean(password),
    submitDisabled: Boolean(submit?.disabled),
  };
})()
`;

const loginWithUi = async (page, role) => {
  await page.goto(`${BASE_URL}/login`);
  await page.eval(clearBrowserStateScript);
  await page.goto(`${BASE_URL}/login`);
  await page.waitFor('Boolean(document.querySelector("#email"))', 10000);
  await page.waitFor(
    `Object.keys(document.querySelector("form") ?? {}).some((key) => key.startsWith("__react"))`,
    20000
  );
  await page.wait(600);
  await page.fillSelector("#email", role.email);
  await page.fillSelector("#password", role.password);
  const humanChecked = await page.eval(`
    Array.from(document.querySelectorAll('input[type="checkbox"]')).at(-1)?.checked ?? false
  `);
  if (!humanChecked) {
    await page.eval(`
      Array.from(document.querySelectorAll('input[type="checkbox"]')).at(-1)?.click();
    `);
  }
  await page.wait(300);
  const readyState = await page.eval(loginFormStateScript);
  await page.clickSelector('button[type="submit"]');
  await page.wait(1700);
  const hasConflict = await page.eval(
    `document.body.innerText.includes("Sesion activa detectada") || document.body.innerText.includes("sesion activa")`
  );
  if (hasConflict) {
    await page.eval(clickByTextScript("Cerrar la otra sesion"));
    await page.wait(1700);
  }
  const landed = await page.waitFor(
    `location.pathname === "/${TENANT_ID}/dashboard"`,
    25000
  );
  return {
    landed: Boolean(landed),
    readyState,
  };
};

const routeSmoke = async (page, path) => {
  await page.goto(`${BASE_URL}${path}`);
  await page.wait(1100);
  return {
    path,
    url: await page.eval(sanitizeUrlScript),
    text: await page.eval(visibleTextScript),
  };
};

const findTicketResponses = (page, sessionId) =>
  page.logEntries.filter(
    (entry) =>
      (entry.type === "network-response" || entry.type === "network-failed") &&
      entry.url?.includes(`/reports/cash-closings/${sessionId}/ticket`)
  );

const getLatestClosedSessionIdFromUi = async (page) =>
  page.eval(`
    (() => {
      const text = document.body.innerText;
      const match = text.match(/ticket-cierre-([0-9a-f-]{36})\\.pdf/i);
      if (match) return match[1];
      return null;
    })()
  `);

const runRole = async (role) => {
  const page = await createPage();
  const result = {
    role: role.role,
    email: role.email.replace(/^[^+@]+/, "***"),
    status: "PARCIAL",
    checks: {},
    bugs: [],
    observations: [],
    evidence: [],
  };

  try {
    result.checks.login = await loginWithUi(page, role);
    result.checks.loginRedirectDashboard = result.checks.login.landed;
    result.checks.currentUrlAfterLogin = await page.eval(sanitizeUrlScript);
    result.checks.dashboardText = await page.eval(visibleTextScript);

    const posBefore = await routeSmoke(page, `/${TENANT_ID}/pos`);
    result.checks.posInitialRoute = posBefore;
    result.checks.posInitiallyBlocked = /requiere caja|selecciona contexto|abrir caja/i.test(
      posBefore.text
    );
    result.checks.posAlreadyOperative = /Punto de venta|COBRAR|Buscar productos/i.test(
      posBefore.text
    );
    if (result.checks.posAlreadyOperative) {
      result.observations.push("El rol ya tenia caja/POS operativo al iniciar QA.");
    }

    await page.goto(`${BASE_URL}/${TENANT_ID}/pos/select-context`);
    await page.waitFor(
      `document.body.innerText.includes("Selecciona sucursal y terminal") || document.body.innerText.includes("Contexto POS")`,
      15000
    );
    await page.wait(1000);
    if (role.role === "SUPER_ADMIN") {
      await page.eval(selectFirstOptionByLabelScript("Empresa"));
      await page.wait(700);
    }
    if (role.role === "SUPER_USER" || role.role === "SUPER_ADMIN") {
      await page.eval(selectFirstOptionByLabelScript("Sucursal", "Sucursal Principal"));
      await page.wait(700);
    }
    await page.eval(selectFirstOptionByLabelScript("Terminal"));
    await page.wait(1000);
    result.checks.contextSelects = await page.eval(selectInfoScript);
    result.checks.contextText = await page.eval(visibleTextScript);

    const contextHasConflict = /Ya tienes una caja abierta en otra sucursal o caja/i.test(
      result.checks.contextText
    );
    result.checks.contextHasConflict = contextHasConflict;
    const needsOpening = !contextHasConflict && /Monto de apertura|Abrir caja y entrar al POS/i.test(
      result.checks.contextText
    );
    result.checks.cashAlreadyOpenHandled = !contextHasConflict && /Ya tienes caja abierta en este contexto|Entrar al POS/i.test(
      result.checks.contextText
    );
    if (needsOpening) {
      await page.eval(setLabeledValueScript("Monto de apertura", "1000"));
      await page.wait(400);
    }
    const clickedOpen =
      (await page.eval(clickByTextScript("Abrir caja y entrar al POS"))) ||
      (await page.eval(clickByTextScript("Entrar al POS")));
    result.checks.openCashClick = clickedOpen;
    await page.waitFor(`location.pathname === "/${TENANT_ID}/pos"`, 20000);
    await page.wait(1600);

    result.checks.cashOpened = needsOpening || result.checks.cashAlreadyOpenHandled;
    result.checks.posAfterOpenText = await page.eval(visibleTextScript);
    result.checks.posOperative = /Punto de venta|Buscar productos/i.test(
      result.checks.posAfterOpenText
    ) && !/POS REQUIERE CAJA/i.test(result.checks.posAfterOpenText);

    await page.waitFor(
      `!document.body.innerText.includes("Cargando productos")`,
      20000
    );
    const productClick = await page.eval(firstEnabledProductClickScript);
    result.checks.productClick = productClick;
    if (productClick.clicked) {
      await page.wait(1800);
      result.checks.chargeButtonVisible = await page.waitFor(
        `Array.from(document.querySelectorAll("button")).some((button) => (button.innerText || "").includes("COBRAR") && !button.disabled)`,
        20000
      );
      if (result.checks.chargeButtonVisible) {
        await page.eval(clickByTextScript("COBRAR"));
        await page.waitFor(`document.body.innerText.includes("Cobrar venta")`, 12000);
        result.checks.paymentModalState = await page.eval(ensurePaymentModalReadyScript);
        await page.wait(700);
        await page.eval(clickByTextScript("Confirmar venta", "button", true));
        await page.waitFor(
          `document.body.innerText.includes("Venta confirmada correctamente") || document.body.innerText.includes("No se pudo confirmar la venta")`,
          25000
        );
      }
    }
    result.checks.posSaleText = await page.eval(visibleTextScript);
    result.checks.posSaleDone = /Venta confirmada correctamente|Venta guardada|ESTADO VENTA CONFIRMED/i.test(
      result.checks.posSaleText
    );
    result.checks.posSalePeripheralWarning = /Venta guardada, pero no se pudo contactar el agente de perifericos/i.test(
      result.checks.posSaleText
    );
    if (result.checks.posSalePeripheralWarning) {
      result.observations.push(
        "Venta POS confirmada, con advertencia local de agente de perifericos no disponible."
      );
    }

    const cashRoute = await routeSmoke(page, `/${TENANT_ID}/finance/cash-sessions`);
    result.checks.cashSessionsRoute = cashRoute;
    result.checks.shiftVisible = /Gestion del turno|Caja abierta actual|Cerrar caja|Tu caja en este momento/i.test(
      cashRoute.text
    );
    result.checks.openSessionVisible = /Cerrar caja|Caja abierta actual|OPEN/i.test(
      cashRoute.text
    );

    const clickedClose = await page.eval(clickByTextScript("Cerrar caja", "button"));
    result.checks.closeButtonClick = clickedClose;
    if (clickedClose) {
      await page.waitFor(`document.body.innerText.includes("Efectivo contado")`, 12000);
      await page.eval(setLabeledValueScript("Efectivo contado", "0"));
      await page.eval(setLabeledValueScript("Observacion", `QA ${role.role} ${new Date().toISOString()}`));
      await page.wait(500);
      await page.eval(clickByTextScript("Cerrar caja", "button", true));
      await page.waitFor(
        `document.body.innerText.includes("Caja cerrada correctamente") || document.body.innerText.includes("No se pudo cerrar la caja")`,
        25000
      );
    }
    result.checks.closeResultText = await page.eval(visibleTextScript);
    result.checks.noticeDialogSuccess = /Caja cerrada correctamente/i.test(
      result.checks.closeResultText
    );
    result.checks.noticeDialogError = /No se pudo cerrar la caja/i.test(
      result.checks.closeResultText
    );
    result.checks.ticketActionsInNotice =
      /Ver ticket/i.test(result.checks.closeResultText) &&
      /Descargar PDF/i.test(result.checks.closeResultText) &&
      /Imprimir/i.test(result.checks.closeResultText);

    const noticeScreenshot = `docs/evidencia-${role.role.toLowerCase()}-qa-caja-operativa-notice.png`;
    await page.screenshot(noticeScreenshot);
    result.evidence.push(noticeScreenshot);

    const sessionIdBeforeTicket = await getLatestClosedSessionIdFromUi(page);
    result.checks.closedSessionIdFromUi = sessionIdBeforeTicket;

    if (result.checks.noticeDialogSuccess) {
      const beforeTicketCount = page.logEntries.length;
      result.checks.noticeVerTicketClick = await page.eval(
        clickFirstTicketActionScript("Ver ticket")
      );
      await page.waitFor(
        `document.body.innerText.includes("Vista previa del ticket") || document.body.innerText.includes("No se pudo abrir el PDF") || document.body.innerText.includes("Failed to fetch")`,
        20000
      );
      await page.wait(2500);
      result.checks.noticeTicketModalText = await page.eval(visibleTextScript);
      result.checks.noticeVerTicket = /Vista previa del ticket/i.test(
        result.checks.noticeTicketModalText
      ) && !/No se pudo abrir el PDF|Failed to fetch|No se pudo cargar/i.test(result.checks.noticeTicketModalText);
      result.checks.noticeTicketResponses = sessionIdBeforeTicket
        ? findTicketResponses(page, sessionIdBeforeTicket).slice(-5)
        : page.logEntries.slice(beforeTicketCount).filter((entry) =>
            entry.url?.includes("/reports/cash-closings/")
          );

      await page.eval(clickByTextScript("Cerrar", "button"));
      await page.wait(700);
      result.checks.noticeDownloadClick = await page.eval(
        clickFirstTicketActionScript("Descargar PDF")
      );
      await page.wait(1800);
      result.checks.noticeDownloadResponses = sessionIdBeforeTicket
        ? findTicketResponses(page, sessionIdBeforeTicket).slice(-5)
        : [];
      result.checks.noticePrintClick = await page.eval(
        clickFirstTicketActionScript("Imprimir")
      );
      await page.wait(2500);
      result.checks.noticePrintResponses = sessionIdBeforeTicket
        ? findTicketResponses(page, sessionIdBeforeTicket).slice(-5)
        : [];
    }

    await page.goto(`${BASE_URL}/${TENANT_ID}/finance/cash-sessions`);
    await page.wait(1600);
    result.checks.cashSessionsAfterCloseText = await page.eval(visibleTextScript);
    result.checks.cashSessionsClosedActions =
      /CLOSED/i.test(result.checks.cashSessionsAfterCloseText) &&
      /Ver ticket/i.test(result.checks.cashSessionsAfterCloseText) &&
      /Descargar PDF/i.test(result.checks.cashSessionsAfterCloseText) &&
      /Imprimir/i.test(result.checks.cashSessionsAfterCloseText);
    result.checks.cashSessionsOpenNoTicketText = /El ticket de cierre estara disponible cuando la caja quede cerrada/i.test(
      result.checks.cashSessionsAfterCloseText
    );

    result.checks.historyVerTicketClick = await page.eval(
      clickFirstTicketActionScript("Ver ticket")
    );
    if (result.checks.historyVerTicketClick) {
      await page.waitFor(
        `document.body.innerText.includes("Vista previa del ticket") || document.body.innerText.includes("No se pudo abrir el PDF") || document.body.innerText.includes("Failed to fetch")`,
        20000
      );
      await page.wait(2200);
      result.checks.historyTicketModalText = await page.eval(visibleTextScript);
      result.checks.historyVerTicket = /Vista previa del ticket/i.test(
        result.checks.historyTicketModalText
      ) && !/No se pudo abrir el PDF|Failed to fetch|No se pudo cargar/i.test(result.checks.historyTicketModalText);
      await page.eval(clickByTextScript("Cerrar", "button"));
      await page.wait(700);
    }
    result.checks.historyDownloadClick = await page.eval(
      clickFirstTicketActionScript("Descargar PDF")
    );
    await page.wait(1200);
    result.checks.historyPrintClick = await page.eval(
      clickFirstTicketActionScript("Imprimir")
    );
    await page.wait(1600);

    const finalScreenshot = `docs/evidencia-${role.role.toLowerCase()}-qa-caja-operativa-final.png`;
    await page.screenshot(finalScreenshot);
    result.evidence.push(finalScreenshot);
    result.checks.browserLogs = page.logEntries.slice(-60);
    result.checks.downloads = page.downloads;
    result.checks.popups = page.popupTargets;

    const blockingBugs = [];
    if (!result.checks.loginRedirectDashboard) {
      blockingBugs.push("Login no redirigio a dashboard");
    }
    if (!result.checks.posInitiallyBlocked && !result.checks.posAlreadyOperative) {
      blockingBugs.push("POS inicial no mostro bloqueo ni estado operativo coherente");
    }
    if (!result.checks.openCashClick || !result.checks.cashOpened) {
      blockingBugs.push("No se pudo abrir caja o continuar con caja existente");
    }
    if (!result.checks.posOperative) {
      blockingBugs.push("POS siguio bloqueado o no operativo con caja abierta");
    }
    if (!result.checks.productClick?.clicked) {
      blockingBugs.push("No se pudo agregar producto POS");
    }
    if (!result.checks.posSaleDone) {
      blockingBugs.push("No se pudo confirmar venta POS real");
    }
    if (!result.checks.shiftVisible || !result.checks.openSessionVisible) {
      blockingBugs.push("Gestion de turno/caja no mostro sesion abierta coherente");
    }
    if (!result.checks.closeButtonClick) {
      blockingBugs.push("No aparecio accion Cerrar caja");
    }
    if (!result.checks.noticeDialogSuccess) {
      blockingBugs.push("Cierre no mostro NoticeDialog success");
    }
    if (!result.checks.ticketActionsInNotice) {
      blockingBugs.push("NoticeDialog no mostro acciones Ver/Descargar/Imprimir");
    }
    if (!result.checks.noticeVerTicket) {
      blockingBugs.push("Ver ticket desde cierre no cargo PDF");
    }
    const ticketResponses = [
      ...(result.checks.noticeTicketResponses ?? []),
      ...(result.checks.noticeDownloadResponses ?? []),
      ...(result.checks.noticePrintResponses ?? []),
    ];
    if (!ticketResponses.some((entry) => entry.status === 200)) {
      blockingBugs.push("Ticket real de cierre no obtuvo respuesta PDF 200");
    }
    if (!result.checks.cashSessionsClosedActions) {
      blockingBugs.push("finance/cash-sessions no mostro acciones para sesiones CLOSED");
    }
    if (!result.checks.historyVerTicket) {
      blockingBugs.push("Ver ticket desde finance/cash-sessions no cargo PDF");
    }

    result.bugs = blockingBugs;
    result.status = blockingBugs.length ? "FAIL" : "PASS_CON_OBSERVACIONES";
  } catch (error) {
    result.status = "FAIL";
    result.bugs.push(error instanceof Error ? error.message : String(error));
    try {
      result.checks.failUrl = await page.eval(sanitizeUrlScript);
      result.checks.failText = await page.eval(visibleTextScript);
      const failScreenshot = `docs/evidencia-${role.role.toLowerCase()}-qa-caja-operativa-fail.png`;
      await page.screenshot(failScreenshot);
      result.evidence.push(failScreenshot);
    } catch {
      // ignore evidence failure
    }
  } finally {
    page.close();
  }

  return result;
};

const results = [];
for (const role of roles) {
  results.push(await runRole(role));
}

const payload = {
  baseUrl: BASE_URL,
  apiBaseUrl: API_BASE_URL,
  tenantId: TENANT_ID,
  executedAt: new Date().toISOString(),
  results,
};
const output = JSON.stringify(payload, null, 2);
if (process.env.QA_OUTPUT_PATH) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(process.env.QA_OUTPUT_PATH, output);
}
console.log(output);
