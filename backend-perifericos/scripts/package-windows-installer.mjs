import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const bundleName = `ManusPeripheralAgent-win-x64-${packageJson.version}`;
const bundleRoot = join(projectRoot, "dist-terminal", "windows-x64", bundleName);
const installerSourceRoot = join(projectRoot, "windows-installer");
const assetsRoot = join(installerSourceRoot, "assets");
const embeddedBundleRoot = join(assetsRoot, "bundle", bundleName);
const installerUiRoot = join(projectRoot, "installer-ui");
const embeddedUiRoot = join(assetsRoot, "ui");
const electronPayloadRoot = resolve(projectRoot, "..", "desktop", "electron", "release", "win-unpacked");
const embeddedPosRoot = join(assetsRoot, "pos");
const posPackage = JSON.parse(readFileSync(join(projectRoot, "..", "desktop", "electron", "package.json"), "utf8"));
const posManifestPath = join(assetsRoot, "pos-manifest.json");
const installerManifestPath = join(assetsRoot, "manifest.json");
const outputRoot = join(projectRoot, "dist-installer", "windows-x64");
const outputName = process.env.MANUS_INSTALLER_OUTPUT_NAME || `ManusTerminalSetup-${packageJson.version}-win-x64.exe`;
const outputPath = join(outputRoot, outputName);

const assertBundleReady = () => {
  if (!existsSync(bundleRoot)) {
    throw new Error(`Missing Windows portable bundle: ${bundleRoot}`);
  }
};

const clearReadonlyWindows = (path) => {
  if (process.platform !== "win32") {
    return;
  }
  try {
    execFileSync("cmd.exe", ["/c", "attrib", "-R", "/S", "/D", path], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    // Best effort.
  }
};

const removePath = (path) => rmSync(path, { recursive: true, force: true });

const buildRuntimeHtml = ({ showMockNav }) => {
  let html = readFileSync(join(installerUiRoot, "index.html"), "utf8");
  const css = readFileSync(join(installerUiRoot, "styles.css"), "utf8");
const js = readFileSync(join(installerUiRoot, "app.js"), "utf8");
  const logoPath = join(projectRoot, "..", "web", "public", "LogoManus.png.jpeg");
  if (!existsSync(logoPath)) throw new Error(`Missing Manus logo source: ${logoPath}`);
  const logoDataUri = `data:image/jpeg;base64,${readFileSync(logoPath).toString("base64")}`;
  html = html.replace(/<link[^>]+href=["']styles\.css["'][^>]*>/i, `<style>${css}</style>`);
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i, showMockNav ? `<script>${js}</script>` : "");
  html = html.replaceAll("../../web/public/LogoManus.png.jpeg", logoDataUri);
  if (!showMockNav) {
    html = html.replace(/\s*<div class="step"><span class="step-icon">8<\/span><span class="step-title">Configurando inicio automÃ¡tico<\/span>[\s\S]*?<\/div>/i, "");
    html = html.replace(/\s*<div class="step"><span class="step-icon">9<\/span><span class="step-title">Preparando Manus POS<\/span>[\s\S]*?<\/div>/i, "");
    html = html.replace(/\s*<!-- SOLO PARA EL MOCK\. NO FORMA PARTE DEL INSTALADOR FINAL -->\s*<footer class="prototype-nav">[\s\S]*?<\/footer>/i, "");
    html = html.replace(/(<div class="device-list">)[\s\S]*?(<\/div>\s*<div class="device-footer">)/i, "$1<div class=\"device-card\"><div class=\"device-main\"><div class=\"device-name\">Periféricos opcionales</div><div class=\"device-model\">La detección se habilitará después de instalar el servicio.</div><div class=\"status muted\">No detectado</div></div></div>$2");
    html = html.replace(/(<div class="summary">)[\s\S]*?(<\/div>\s*<div class="cta">)/i, "$1<div class=\"summary-col\"><div class=\"summary-item\"><span class=\"summary-check\">✓</span><span>Servicio de periféricos<br><strong>Activo</strong></span></div></div><div class=\"summary-col\"><div class=\"summary-item\"><span class=\"summary-check\">✓</span><span>Manus POS<br><strong>Listo</strong></span></div></div>$2");
    html = html.replace(/<h2>¡Terminal lista!<\/h2>/i, "<h2>Instalación completada</h2>");
    html = html.replace(/Tu terminal Manus está configurada y lista para usar\./i, "El servicio y Manus POS están instalados.");
    html = html.replace(/(<section class="screen install"[\s\S]*?<div class="steps">)[\s\S]*?(<\/div>\s*<div class="install-actions">)/i, "$1${[\"Verificando requisitos del sistema\",\"Preparando Manus Terminal\",\"Instalando Manus POS\",\"Instalando servicio de periféricos\",\"Configurando servicio y permisos\",\"Iniciando servicio Manus\",\"Verificando comunicación local\",\"Detectando dispositivos\",\"Creando accesos directos\",\"Verificando Manus Terminal\",\"Finalizando instalación\"].map((name)=>`<div class=\"step\"><span class=\"step-icon\">○</span><span class=\"step-title\">${name}</span><span class=\"step-status\">Pendiente</span></div>`).join(\"\")}$2");
    html = html.replace(/(<div class="log-box">)[\s\S]*?(<\/div>)/i, "$1Diagnóstico disponible después de la instalación.$2");
  }
  if (/src=["']app\.js["']|href=["']styles\.css["']|(?:src|href)=["'][^"']*LogoManus\.png\.jpeg|file:\/\/|https?:\/\//i.test(html)) {
    throw new Error("runtime UI HTML contains unresolved or remote assets");
  }
  if (!showMockNav) {
    const coreStepMarkup = ["Verificando requisitos del sistema", "Preparando Manus Terminal", "Instalando Manus POS", "Instalando servicio de perifÃ©ricos", "Configurando servicio y permisos", "Iniciando servicio Manus", "Verificando comunicaciÃ³n local", "Detectando dispositivos", "Creando accesos directos", "Verificando Manus Terminal", "Finalizando instalaciÃ³n"].map((name) => `<div class="step"><span class="step-icon">â—‹</span><span class="step-title">${name}</span><span class="step-status">Pendiente</span></div>`).join("");
    html = html.replace(/(<section class="screen install"[\s\S]*?<div class="steps">)[\s\S]*?(<\/div>\s*<div class="install-actions">)/i, `$1${coreStepMarkup}$2`);
  }
  const runtimeCss = `<style data-manus-runtime="true">\n.window-bar{display:none!important;}\n${showMockNav ? "" : ".prototype-nav{display:none!important;}"}\n</style>`;
  return html.replace("</head>", `${runtimeCss}</head>`);
};

const assertPosReady = () => {
  if (!existsSync(join(electronPayloadRoot, "Manus POS.exe"))) {
    throw new Error(`Missing Electron win-unpacked payload: ${electronPayloadRoot}`);
  }
  for (const required of ["resources/app.asar", "resources/manus-shell.config.json"]) {
    if (!existsSync(join(electronPayloadRoot, required))) throw new Error(`Missing POS payload file: ${required}`);
  }
};

const posFiles = (root, relative = "") => readdirSync(join(root, relative), { withFileTypes: true }).flatMap((entry) => {
  const rel = join(relative, entry.name);
  return entry.isDirectory() ? posFiles(root, rel) : [rel];
});

const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

try {
  assertBundleReady();
  assertPosReady();
  clearReadonlyWindows(embeddedBundleRoot);
  clearReadonlyWindows(installerManifestPath);
  clearReadonlyWindows(outputPath);
  removePath(embeddedBundleRoot);
  removePath(embeddedPosRoot);
  removePath(posManifestPath);
  removePath(embeddedUiRoot);
  removePath(installerManifestPath);
  removePath(outputPath);
  mkdirSync(dirname(embeddedBundleRoot), { recursive: true });
  mkdirSync(outputRoot, { recursive: true });

  cpSync(bundleRoot, embeddedBundleRoot, { recursive: true });
  cpSync(electronPayloadRoot, embeddedPosRoot, { recursive: true });
  const files = posFiles(electronPayloadRoot).sort().map((relativePath) => ({
    path: relativePath.replaceAll("\\", "/"),
    size: statSync(join(electronPayloadRoot, relativePath)).size,
    sha256: sha256File(join(electronPayloadRoot, relativePath)),
  }));
  writeFileSync(posManifestPath, `${JSON.stringify({ schemaVersion: 1, posVersion: posPackage.version, executable: "Manus POS.exe", shellConfig: "resources/manus-shell.config.json", payloadSize: files.reduce((sum, file) => sum + file.size, 0), files }, null, 2)}\n`, "utf8");
  mkdirSync(embeddedUiRoot, { recursive: true });
  for (const fileName of ["index.html", "styles.css", "app.js"]) {
    cpSync(join(installerUiRoot, fileName), join(embeddedUiRoot, fileName));
  }
  writeFileSync(join(embeddedUiRoot, "index.runtime.html"), buildRuntimeHtml({ showMockNav: true }), "utf8");
  writeFileSync(join(embeddedUiRoot, "index.runtime.productive.html"), buildRuntimeHtml({ showMockNav: false }), "utf8");

  writeFileSync(
    installerManifestPath,
    `${JSON.stringify({
      version: packageJson.version,
      bundleDirName: bundleName,
      bundleRoot: `assets/bundle/${bundleName}`,
      serviceName: "ManusPeripheralAgent",
      displayName: "Manus Peripheral Agent",
      description: "Manus Peripheral Agent installer and Windows service host",
      agentName: "manus-pos-peripheral-agent",
      serviceAccount: "NT AUTHORITY\\LocalService",
      serviceArgs: ["service"],
      healthUrl: "http://127.0.0.1:4050/health",
      installRoot: `C:\\Program Files\\Manus\\PeripheralAgent`,
      programDataRoot: `C:\\ProgramData\\Manus\\PeripheralAgent`,
      configRelative: `config\\agent.config.local.json`,
      logsRelative: `logs`,
      stateRelative: `state`,
      versionFileName: "VERSION.json",
      posVersion: posPackage.version,
      posRoot: `assets/pos`,
      posManifest: `assets/pos-manifest.json`,
    }, null, 2)}\n`,
    "utf8",
  );

  execFileSync(
    "go",
    [
      "build",
      "-trimpath",
      "-ldflags",
      "-s -w",
      "-o",
      outputPath,
      ".",
    ],
    {
      cwd: installerSourceRoot,
      stdio: "inherit",
      windowsHide: true,
    }
  );

  console.log(`Installer created: ${outputPath}`);
  console.log(`Installer version: ${packageJson.version}`);
  console.log(`Embedded bundle: ${embeddedBundleRoot}`);
} finally {
  // Keep embedded assets in the working tree so the installer can be rebuilt
  // and inspected. The build output itself is still reproducible.
}
