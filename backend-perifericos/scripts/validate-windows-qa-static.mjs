import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { QA_AGENT_VERSION, resolveAgentVersion } from "./agent-version.mjs";
import { assertPackagedPosVersions, readPosVersion } from "./pos-version.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const rootDirectory = resolve(projectRoot, "..");
const electronRequire = createRequire(join(rootDirectory, "desktop", "electron", "package.json"));
const electronAsar = electronRequire("@electron/asar");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const installerName = `ManusTerminalSetup-${QA_AGENT_VERSION}-win-x64.exe`;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const hashFile = (path) => new Promise((resolveHash, reject) => {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolveHash(hash.digest("hex")));
});

const fileContainsMarker = (path, marker) => new Promise((resolveMarker, reject) => {
  const stream = createReadStream(path);
  const needle = Buffer.from(marker);
  let tail = Buffer.alloc(0);
  stream.on("data", (chunk) => {
    const combined = tail.length ? Buffer.concat([tail, chunk]) : chunk;
    if (combined.includes(needle)) {
      stream.destroy();
      resolveMarker(true);
      return;
    }
    tail = combined.subarray(Math.max(0, combined.length - needle.length + 1));
  });
  stream.on("error", (error) => {
    if (error.code !== "ERR_STREAM_PREMATURE_CLOSE") reject(error);
  });
  stream.on("end", () => resolveMarker(false));
});

const inspectPeFile = (path) => {
  const descriptor = openSync(path, "r");
  try {
    const header = Buffer.alloc(65536);
    const read = readSync(descriptor, header, 0, header.length, 0);
    return inspectPeX64(header.subarray(0, read));
  } finally {
    closeSync(descriptor);
  }
};

export const validateQaAgentConfig = (config) => {
  assert.equal(config.packageProfile, "qa", "Agent package profile must be QA");
  assert.equal(config.mode, "REAL", "QA package must retain real adapter mode");
  assert.equal(config.enableRealAdapters, true, "QA package must include real adapters");
  assert.equal(config.discoverOnStartup, false, "QA package must keep startup discovery disabled");
  assert.equal(config.enrollmentApiBaseUrl, "https://api.apptiendamanus.space/api");
  assert.equal(config.enrollmentAudience, "manus-agent:qa");
  assert.equal(config.enrollmentSigningPublicKeyPem, "", "QA signing public key must remain absent");
  assert.equal(config.enrollmentSigningKeyId, "", "QA signing key ID must remain absent");
  return config;
};

export const validateInstallerDiscoveryGateSource = (source) => {
  assert.match(source, /config\.PackageProfile\s*!=\s*"dev"\s*&&\s*config\.PackageProfile\s*!=\s*"production"/, "installer must suppress startup discovery for the QA profile");
  assert.match(source, /return\s+\*config\.EnableRealAdapters\s*&&\s*\*config\.DiscoverOnStartup/, "installer discovery must require both explicit booleans");
  return true;
};

export const inspectPeX64 = (data) => {
  assert.ok(Buffer.isBuffer(data), "PE input must be a Buffer");
  assert.equal(data.toString("ascii", 0, 2), "MZ", "installer must have a DOS header");
  const peOffset = data.readUInt32LE(0x3c);
  assert.ok(peOffset + 24 <= data.length, "installer PE header is truncated");
  assert.equal(data.toString("ascii", peOffset, peOffset + 4), "PE\0\0", "installer must have a PE signature");
  assert.equal(data.readUInt16LE(peOffset + 4), 0x8664, "installer must target AMD64");
  const optionalHeaderSize = data.readUInt16LE(peOffset + 20);
  const optionalHeaderOffset = peOffset + 24;
  assert.ok(optionalHeaderOffset + optionalHeaderSize <= data.length, "installer optional header is truncated");
  assert.equal(data.readUInt16LE(optionalHeaderOffset), 0x20b, "installer must use the PE32+ format");
  const certificateEntryOffset = optionalHeaderOffset + 112 + (4 * 8);
  assert.ok(certificateEntryOffset + 8 <= optionalHeaderOffset + optionalHeaderSize, "installer certificate directory is missing");
  const certificateSize = data.readUInt32LE(certificateEntryOffset + 4);
  return {
    machine: "AMD64",
    format: "PE32+",
    authenticode: certificateSize === 0 ? "NOT_SIGNED" : "SIGNATURE_PRESENT_UNVERIFIED",
  };
};

const inventoryTree = async (root, current = root) => {
  const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.name.toLowerCase().includes("qa-uac-observer")) {
      throw new Error(`Forbidden QA observer asset found: ${join(current, entry.name)}`);
    }
    const path = join(current, entry.name);
    const metadata = lstatSync(path);
    if (metadata.isSymbolicLink() || entry.isSymbolicLink()) {
      throw new Error(`Reparse or symbolic link is not allowed in static package input: ${path}`);
    }
    if (metadata.isDirectory()) {
      files.push(...await inventoryTree(root, path));
    } else if (metadata.isFile()) {
      files.push({ path: relative(root, path).split(sep).join("/"), size: metadata.size, sha256: await hashFile(path) });
    } else {
      throw new Error(`Unsupported asset type: ${path}`);
    }
  }
  return files;
};

const verifyPosPayload = async (assetsRoot, posManifest) => {
  assert.equal(Array.isArray(posManifest.files), true, "POS manifest files must be an array");
  const posRoot = join(assetsRoot, "pos");
  const declaredPaths = new Set();
  let payloadSize = 0;
  for (const file of posManifest.files) {
    assert.equal(typeof file.path, "string");
    assert.equal(file.path.includes(".."), false, `POS manifest path traverses directories: ${file.path}`);
    const normalized = file.path.replaceAll("\\", "/");
    const path = resolve(posRoot, normalized);
    assert.ok(path.startsWith(`${resolve(posRoot)}${sep}`), `POS manifest path escapes payload: ${file.path}`);
    assert.equal(declaredPaths.has(normalized), false, `Duplicate POS manifest entry: ${normalized}`);
    declaredPaths.add(normalized);
    const metadata = lstatSync(path);
    assert.equal(metadata.isFile(), true, `POS asset is not a regular file: ${normalized}`);
    assert.equal(metadata.size, file.size, `POS size mismatch: ${normalized}`);
    assert.equal(await hashFile(path), file.sha256, `POS SHA-256 mismatch: ${normalized}`);
    payloadSize += metadata.size;
  }
  assert.equal(payloadSize, posManifest.payloadSize, "POS payload byte total does not match its manifest");
  assert.equal((await inventoryTree(posRoot)).length, declaredPaths.size, "POS payload contains undeclared files");
  return { files: declaredPaths.size, payloadSize };
};

export const validatePackagedClosePolicy = (appAsarPath, asar = electronAsar) => {
  const entries = new Set(asar.listPackage(appAsarPath).map((entry) => `/${entry.replaceAll("\\", "/").split("/").filter(Boolean).join("/")}`));
  assert.ok(entries.has("/dist/main.js"), "POS app.asar must contain dist/main.js");
  assert.ok(entries.has("/dist/window-close-policy.js"), "POS app.asar must contain the compiled close-policy module");

  const mainSource = asar.extractFile(appAsarPath, "dist/main.js").toString("utf8");
  const policySource = asar.extractFile(appAsarPath, "dist/window-close-policy.js").toString("utf8");
  assert.match(mainSource, /require\([\"']\.\/window-close-policy\.js[\"']\)/, "compiled POS main must resolve the close-policy module");
  assert.match(policySource, /handleWindowClose/, "compiled close-policy module must export the wired handler");
  return { main: "/dist/main.js", closePolicy: "/dist/window-close-policy.js", resolved: true };
};

export const validateStaticQaPackage = async ({
  root = projectRoot,
  outputName = installerName,
  posVersion = readPosVersion(rootDirectory),
} = {}) => {
  const buildRoot = resolve(root);
  const agentRoot = join(buildRoot, "dist-terminal", "windows-x64", `ManusPeripheralAgent-win-x64-${QA_AGENT_VERSION}`);
  const assetsRoot = join(buildRoot, "windows-installer", "assets");
  const installerPath = join(buildRoot, "dist-installer", "windows-x64", outputName);
  const expectedVersion = resolveAgentVersion({ packageVersion: packageJson.version, environment: "qa" });

  assert.equal(expectedVersion, QA_AGENT_VERSION);
  assert.equal(basename(outputName), outputName, "installer output name must be a filename");
  assert.equal(outputName, installerName, "installer name must identify the approved QA version");

  const agentVersion = readJson(join(agentRoot, "VERSION.json"));
  assert.equal(agentVersion.agent, "manus-pos-peripheral-agent");
  assert.equal(agentVersion.version, expectedVersion);
  assert.equal(agentVersion.platform, "win32");
  assert.equal(agentVersion.architecture, "x64");
  assert.match(agentVersion.runtime, /^v?24\.21\.0$/);

  const configPath = join(agentRoot, "config", "agent.config.local.json");
  const configData = readFileSync(configPath);
  const config = validateQaAgentConfig(JSON.parse(configData.toString("utf8")));
  const exampleConfig = validateQaAgentConfig(readJson(join(agentRoot, "config", "agent.config.example.json")));
  assert.deepEqual(exampleConfig, config, "example and local Agent configs must agree");

  const installerManifestPath = join(assetsRoot, "manifest.json");
  const installerManifestData = readFileSync(installerManifestPath);
  const installerManifest = JSON.parse(installerManifestData.toString("utf8"));
  assert.equal(installerManifest.version, expectedVersion);
  assert.equal(installerManifest.bundleDirName, `ManusPeripheralAgent-win-x64-${expectedVersion}`);
  assert.equal(installerManifest.bundleRoot, `assets/bundle/ManusPeripheralAgent-win-x64-${expectedVersion}`);
  assert.equal(installerManifest.serviceName, "ManusPeripheralAgent");
  assert.equal(installerManifest.serviceAccount, "NT AUTHORITY\\LocalService");

  const embeddedAgentConfig = readFileSync(join(assetsRoot, "bundle", installerManifest.bundleDirName, "config", "agent.config.local.json"));
  assert.deepEqual(embeddedAgentConfig, configData, "installer must embed the same QA Agent config");
  validateQaAgentConfig(JSON.parse(embeddedAgentConfig.toString("utf8")));

  const shellConfig = readJson(join(assetsRoot, "pos", "resources", "manus-shell.config.json"));
  assert.equal(shellConfig.environment, "qa");
  assert.equal(shellConfig.frontendUrl, "https://www.apptiendamanus.space/login");
  assert.deepEqual(shellConfig.allowedOrigins, ["https://www.apptiendamanus.space"]);
  assert.equal(shellConfig.agentLoopbackOrigin, "http://127.0.0.1:4050");

  const posManifestData = readFileSync(join(assetsRoot, "pos-manifest.json"));
  const posManifest = JSON.parse(posManifestData.toString("utf8"));
  assertPackagedPosVersions({ expected: posVersion, installerManifest, posManifest });
  assert.equal(posManifest.executable, "Manus POS.exe");
  const pos = await verifyPosPayload(assetsRoot, posManifest);
  const closePolicy = validatePackagedClosePolicy(join(assetsRoot, "pos", "resources", "app.asar"));

  const runtimeUiPath = join(assetsRoot, "ui", "index.runtime.productive.html");
  const appJsPath = join(assetsRoot, "ui", "app.js");
  const runtimeUiData = readFileSync(runtimeUiPath);
  const appJsData = readFileSync(appJsPath);
  const installerGateSource = readFileSync(join(buildRoot, "windows-installer", "productive_ui_windows.go"), "utf8");
  validateInstallerDiscoveryGateSource(installerGateSource);
  assert.equal(runtimeUiData.toString("utf8").includes("discoverOnStartup"), false, "installer runtime HTML must not add an auto-discovery override");
  assert.equal(appJsData.toString("utf8").includes("data-action=\"discover\""), true, "prototype discovery remains an explicit user action");

  const pe = inspectPeFile(installerPath);
  const embeddedMarkers = [
    ["qa-agent-config", configData],
    ["installer-manifest", installerManifestData],
    ["pos-manifest", posManifestData],
    ["qa-shell-config", readFileSync(join(assetsRoot, "pos", "resources", "manus-shell.config.json"))],
    ["productive-installer-ui", runtimeUiData],
    ["installer-ui-source", appJsData],
    ["installer-discovery-policy", Buffer.from("discoverOnStartup")],
    ["installer-discovery-route", Buffer.from("devices/discover")],
  ];
  for (const [name, marker] of embeddedMarkers) {
    assert.equal(await fileContainsMarker(installerPath, marker), true, `installer does not contain its expected embedded marker: ${name}`);
  }
  const qaUacObserverMarkerFound = await fileContainsMarker(installerPath, Buffer.from("qa-uac-observer"));
  assert.equal(qaUacObserverMarkerFound, false, "installer must not contain the QA UAC observer");

  const assets = await inventoryTree(assetsRoot);
  const agentConfigSha256 = sha256(configData);
  const installerSha256 = await hashFile(installerPath);
  const buildManifest = {
    schemaVersion: 1,
    candidateId: `manus-terminal-${expectedVersion}-win-x64`,
    environment: "qa",
    installer: {
      file: outputName,
      size: statSync(installerPath).size,
      sha256: installerSha256,
      machine: pe.machine,
      format: pe.format,
      authenticode: pe.authenticode,
    },
    agent: {
      name: agentVersion.agent,
      version: agentVersion.version,
      runtime: agentVersion.runtime,
      packageProfile: config.packageProfile,
      mode: config.mode,
      enableRealAdapters: config.enableRealAdapters,
      discoverOnStartup: config.discoverOnStartup,
      configSha256: agentConfigSha256,
    },
    enrollment: {
      endpoint: config.enrollmentApiBaseUrl,
      audience: config.enrollmentAudience,
      signingPublicKeyPresent: false,
      signingKeyIdPresent: false,
      status: "BLOCKED",
    },
    pos: {
      version: posManifest.posVersion,
      manifestFiles: pos.files,
      payloadSize: pos.payloadSize,
    },
    staticChecks: {
      embeddedMarkers: embeddedMarkers.map(([name]) => name),
      installerDiscoveryGateSource: "qa-profile-and-two-boolean-policy-verified",
      electronClosePolicy: closePolicy,
      qaUacObserverIncluded: false,
      qaUacObserverMarkerFound,
      generatedExecutablesRun: false,
      hardwareAccessed: false,
    },
    assets,
  };

  const reportPath = installerPath.replace(/\.exe$/i, ".build-manifest.json");
  writeFileSync(reportPath, `${JSON.stringify(buildManifest, null, 2)}\n`, { flag: "wx" });
  return { installerPath, reportPath, manifest: buildManifest };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const result = await validateStaticQaPackage({ outputName: process.env.MANUS_INSTALLER_OUTPUT_NAME || installerName });
    console.log(JSON.stringify({ status: "STATIC_VALIDATION_PASS", ...result }, null, 2));
  } catch (error) {
    console.error(`STATIC_VALIDATION_FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
