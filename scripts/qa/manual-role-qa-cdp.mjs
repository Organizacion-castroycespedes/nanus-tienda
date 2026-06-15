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
    role: "USER",
    email: USER_EMAIL,
    password: PASSWORD,
    expectedAdminMenu: false,
  },
  {
    role: "ADMIN",
    email: ADMIN_EMAIL,
    password: PASSWORD,
    expectedAdminMenu: true,
  },
  {
    role: "SUPER_USER",
    email: SUPER_USER_EMAIL,
    password: PASSWORD,
    expectedAdminMenu: true,
  },
  {
    role: "SUPER_ADMIN",
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    expectedAdminMenu: true,
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
        if (message.method === "Runtime.consoleAPICalled") {
          this.logEntries.push({
            type: "console",
            args: (message.params?.args ?? []).map((arg) => arg.value ?? arg.description),
          });
        }
        if (message.method === "Network.loadingFailed") {
          this.logEntries.push({
            type: "network-failed",
            errorText: message.params?.errorText,
            blockedReason: message.params?.blockedReason,
          });
        }
        if (message.method === "Network.responseReceived") {
          const response = message.params?.response;
          if (
            response?.url?.includes("/_next/") ||
            response?.url?.includes("/api/") ||
            Number(response?.status ?? 0) >= 400
          ) {
            this.logEntries.push({
              type: "network-response",
              status: response.status,
              url: response.url,
            });
          }
        }
        if (message.method === "Log.entryAdded") {
          this.logEntries.push({
            type: "log",
            level: message.params?.entry?.level,
            text: message.params?.entry?.text,
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
    await this.wait(700);
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

const jsString = (value) => JSON.stringify(value);

const visibleTextScript = `
(() => {
  const text = document.body?.innerText ?? "";
  return text.replace(/\\s+/g, " ").trim();
})()
`;

const menuTextScript = `
(() => {
  const text = document.querySelector("aside")?.innerText ?? "";
  return text.replace(/\\s+/g, " ").trim();
})()
`;

const menuLinksScript = `
(() => Array.from(document.querySelectorAll("aside a, header a")).map((link) => ({
  text: (link.innerText || link.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
  href: link.href,
})))()
`;

const expandSidebarScript = `
(() => {
  const buttons = Array.from(document.querySelectorAll('aside button[aria-label^="Expandir"]'));
  buttons.forEach((button) => button.click());
  return buttons.length;
})()
`;

const authRoleScript = `
(() => {
  return {
    localStorageKeys: Object.keys(window.localStorage),
    sessionStorageKeys: Object.keys(window.sessionStorage),
  };
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

const setLoginFormScript = (email, password) => `
(() => {
  const setValue = (selector, value) => {
    const input = document.querySelector(selector);
    if (!input) return false;
    const proto = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor.set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  const setChecked = () => {
    const checks = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const human = checks[checks.length - 1];
    if (!human) return false;
    if (!human.checked) human.click();
    return true;
  };
  setValue("#email", ${jsString(email)});
  setValue("#password", ${jsString(password)});
  setChecked();
  return true;
})()
`;

const clickByTextScript = (text) => `
(() => {
  const target = ${jsString(text)};
  const candidates = Array.from(document.querySelectorAll("button,a"));
  const element = candidates.find((item) =>
    (item.innerText || item.textContent || "").trim().includes(target)
  );
  if (!element) return false;
  element.click();
  return true;
})()
`;

const clickSubmitScript = `
(() => {
  const form = document.querySelector("form");
  if (!form) return false;
  const button = form.querySelector('button[type="submit"]');
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
  const checks = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  const submit = form?.querySelector('button[type="submit"]');
  return {
    hasForm: Boolean(form),
    hasEmail: Boolean(email),
    hasPassword: Boolean(password),
    checkboxStates: checks.map((item) => item.checked),
    submitText: submit?.innerText ?? "",
    submitDisabled: Boolean(submit?.disabled),
    formReactKeys: form ? Object.keys(form).filter((key) => key.startsWith("__react")) : [],
    submitReactKeys: submit ? Object.keys(submit).filter((key) => key.startsWith("__react")) : [],
    scriptCount: document.scripts.length,
    nextScripts: Array.from(document.scripts)
      .map((script) => script.src)
      .filter((src) => src.includes("/_next/"))
      .slice(0, 20),
    nextDataPresent: Boolean(document.querySelector("#__NEXT_DATA__")),
    nextGlobals: {
      next: typeof window.next,
      webpackChunk: typeof window.webpackChunk_N_E,
    },
  };
})()
`;

const selectInfoScript = `
(() => Array.from(document.querySelectorAll("select")).map((select) => ({
  label: select.closest("label")?.innerText ||
    document.querySelector('label[for="' + select.id + '"]')?.innerText ||
    select.getAttribute("aria-label") ||
    "",
  disabled: select.disabled,
  value: select.value,
  options: Array.from(select.options).map((option) => ({
    value: option.value,
    text: option.text,
    disabled: option.disabled,
  })),
})))()
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
  const beforeText = await page.eval(visibleTextScript);
  const beforeState = await page.eval(loginFormStateScript);
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
  await page.wait(1600);
  const hasConflict = await page.eval(
    `document.body.innerText.includes("Sesion activa detectada") || document.body.innerText.includes("sesion activa")`
  );
  if (hasConflict) {
    await page.eval(clickByTextScript("Cerrar la otra sesion"));
    await page.wait(1600);
  }
  const landed = await page.waitFor(
    `location.pathname === "/${TENANT_ID}/dashboard"`,
    20000
  );
  return {
    landed: Boolean(landed),
    beforeText,
    beforeState,
    readyState,
  };
};

const routeSmoke = async (page, path) => {
  await page.goto(`${BASE_URL}${path}`);
  await page.wait(900);
  return {
    path,
    url: await page.eval("location.href"),
    text: await page.eval(visibleTextScript),
  };
};

const apiGet = async (page, path) =>
  page.eval(`
    fetch(${jsString(`${API_BASE_URL}${path}`)}, { credentials: "include" })
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        body: await response.text(),
      }))
      .catch((error) => ({ ok: false, status: 0, body: String(error) }))
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
    result.checks.loginTextAfterSubmit = await page.eval(visibleTextScript);
    result.checks.browserLogs = page.logEntries.slice(-20);
    await page.eval(expandSidebarScript);
    await page.wait(400);
    result.checks.menuText = await page.eval(menuTextScript);
    result.checks.menuLinks = await page.eval(menuLinksScript);
    result.checks.storage = await page.eval(authRoleScript);
    result.checks.authStoragePresent = Boolean(
      result.checks.storage?.sessionStorageKeys?.length ||
        result.checks.storage?.localStorageKeys?.length
    );

    const currentCash = await apiGet(page, "/finance/cash-sessions/current");
    result.checks.currentCashStatus = currentCash.status;
    result.checks.currentCashBodyStart = currentCash.body.slice(0, 180);
    let currentCashObject = null;
    try {
      currentCashObject = JSON.parse(currentCash.body || "null");
    } catch {
      currentCashObject = null;
    }
    result.checks.hasCurrentCash = Boolean(currentCashObject?.id);

    const dashboardPath = `/${TENANT_ID}/dashboard`;
    const posPath = `/${TENANT_ID}/pos`;
    const contextPath = `/${TENANT_ID}/pos/select-context`;
    const cashPath = `/${TENANT_ID}/finance/cash-sessions`;
    const adminPaths = [
      `/${TENANT_ID}/purchases`,
      `/${TENANT_ID}/inventory/products`,
      `/${TENANT_ID}/inventory/units`,
      `/${TENANT_ID}/inventory/taxes`,
      `/${TENANT_ID}/inventory/suppliers`,
      `/${TENANT_ID}/inventory/promotions`,
    ];

    result.checks.dashboardRoute = await routeSmoke(page, dashboardPath);
    result.checks.posNoCashRoute = await routeSmoke(page, posPath);
    result.checks.posNoCashBlocked =
      !result.checks.hasCurrentCash &&
      /abrir caja|requiere caja|seleccion de contexto|select-context/i.test(
        result.checks.posNoCashRoute.text
      );
    result.checks.contextRoute = await routeSmoke(page, contextPath);
    result.checks.contextSelects = await page.eval(selectInfoScript);
    result.checks.cashSessionsRoute = await routeSmoke(page, cashPath);
    result.checks.cashTurnoText =
      /Gestion del turno|Turno|Caja abierta|Movimientos|Arqueo|Tickets/i.test(
        result.checks.cashSessionsRoute.text
      );

    result.checks.adminRoutes = {};
    for (const path of adminPaths) {
      result.checks.adminRoutes[path] = await routeSmoke(page, path);
    }

    const menuSurface = [
      result.checks.menuText,
      result.checks.loginTextAfterSubmit,
      ...(result.checks.menuLinks ?? []).map((link) => `${link.text} ${link.href}`),
    ].join(" ");

    result.checks.menuHas = {
      dashboard: /dashboard|panel de control/i.test(menuSurface),
      pos: /\bpos\b/i.test(result.checks.menuText),
      purchases: /compras|\/purchases/i.test(menuSurface),
      products: /productos|\/inventory\/products/i.test(menuSurface),
      units: /unidades|\/inventory\/units/i.test(menuSurface),
      taxes: /impuestos|\/inventory\/taxes/i.test(menuSurface),
      suppliers: /proveedores|\/inventory\/suppliers/i.test(menuSurface),
      promotions: /promociones|\/inventory\/promotions/i.test(menuSurface),
      requiresCash: /requiere caja/i.test(result.checks.menuText),
    };

    const screenshotPath = `docs/evidencia-${role.role.toLowerCase()}-qa-caja-roles-menu.png`;
    await page.screenshot(screenshotPath);
    result.evidence.push(screenshotPath);

    const blockingBugs = [];
    if (!result.checks.loginRedirectDashboard) {
      blockingBugs.push("Login no redirigio a dashboard");
    }
    if (!result.checks.menuHas.dashboard || !result.checks.menuHas.pos) {
      blockingBugs.push("Menu base no muestra Dashboard/POS");
    }
    if (!result.checks.hasCurrentCash && !result.checks.posNoCashBlocked) {
      blockingBugs.push("POS sin caja no mostro bloqueo operativo esperado");
    }
    const isBlockedRoute = (route) =>
      /UNAUTHORIZED|No tienes permiso|Pagina no encontrada|404/i.test(
        route?.text ?? ""
      );
    const requiredAdminPaths = [
      `/${TENANT_ID}/purchases`,
      `/${TENANT_ID}/inventory/products`,
      `/${TENANT_ID}/inventory/units`,
      `/${TENANT_ID}/inventory/taxes`,
      `/${TENANT_ID}/inventory/suppliers`,
      `/${TENANT_ID}/inventory/promotions`,
    ];
    if (role.role === "USER") {
      for (const path of requiredAdminPaths) {
        if (!isBlockedRoute(result.checks.adminRoutes[path])) {
          blockingBugs.push(`USER accedio a ruta administrativa: ${path}`);
        }
      }
      const forbiddenMenuItems = [
        "purchases",
        "products",
        "units",
        "taxes",
        "suppliers",
        "promotions",
      ].filter((key) => result.checks.menuHas[key]);
      if (forbiddenMenuItems.length > 0) {
        blockingBugs.push(
          `USER ve modulos administrativos en menu: ${forbiddenMenuItems.join(", ")}`
        );
      }
    } else {
      for (const path of requiredAdminPaths) {
        if (isBlockedRoute(result.checks.adminRoutes[path])) {
          blockingBugs.push(`${role.role} no accedio a ruta esperada: ${path}`);
        }
      }
      const missingMenuItems = [
        "purchases",
        "products",
        "units",
        "taxes",
        "suppliers",
        "promotions",
      ].filter((key) => !result.checks.menuHas[key]);
      if (missingMenuItems.length > 0) {
        blockingBugs.push(
          `${role.role} no ve modulos administrativos en menu: ${missingMenuItems.join(", ")}`
        );
      }
    }
    result.bugs = blockingBugs;
    result.status = blockingBugs.length ? "FAIL" : "PASS_CON_OBSERVACIONES";
  } catch (error) {
    result.status = "FAIL";
    result.bugs.push(error instanceof Error ? error.message : String(error));
  } finally {
    page.close();
  }

  return result;
};

const results = [];
for (const role of roles) {
  results.push(await runRole(role));
}

const payload = { baseUrl: BASE_URL, apiBaseUrl: API_BASE_URL, tenantId: TENANT_ID, results };
const output = JSON.stringify(payload, null, 2);
if (process.env.QA_OUTPUT_PATH) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(process.env.QA_OUTPUT_PATH, output);
}
console.log(output);
