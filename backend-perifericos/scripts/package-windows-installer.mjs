import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i, `<script>${js}</script>`);
  html = html.replaceAll("../../web/public/LogoManus.png.jpeg", logoDataUri);
  if (/src=["']app\.js["']|href=["']styles\.css["']|(?:src|href)=["'][^"']*LogoManus\.png\.jpeg|file:\/\/|https?:\/\//i.test(html)) {
    throw new Error("runtime UI HTML contains unresolved or remote assets");
  }
  const runtimeCss = `<style data-manus-runtime="true">\n.window-bar{display:none!important;}\n${showMockNav ? "" : ".prototype-nav{display:none!important;}"}\n</style>`;
  return html.replace("</head>", `${runtimeCss}</head>`);
};

try {
  assertBundleReady();
  clearReadonlyWindows(embeddedBundleRoot);
  clearReadonlyWindows(installerManifestPath);
  clearReadonlyWindows(outputPath);
  removePath(embeddedBundleRoot);
  removePath(embeddedUiRoot);
  removePath(installerManifestPath);
  removePath(outputPath);
  mkdirSync(dirname(embeddedBundleRoot), { recursive: true });
  mkdirSync(outputRoot, { recursive: true });

  cpSync(bundleRoot, embeddedBundleRoot, { recursive: true });
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
