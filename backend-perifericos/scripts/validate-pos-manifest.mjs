import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const fail = (message) => {
  throw new Error(`POS manifest integrity validation failed: ${message}`);
};

const safeRelativePath = (value) => {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || isAbsolute(value)) {
    fail(`unsafe manifest path: ${String(value)}`);
  }
  const normalized = normalize(value).replaceAll("\\", "/");
  if (normalized !== value || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || value.startsWith("/")) {
    fail(`unsafe manifest path: ${value}`);
  }
  return value;
};

const pathWithinRoot = (root, manifestPath) => {
  const candidate = resolve(root, ...manifestPath.split("/"));
  const relativePath = relative(root, candidate);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    fail(`manifest path escapes payload root: ${manifestPath}`);
  }
  return candidate;
};

export const validatePosManifest = ({ payloadRoot, manifestPath }) => {
  if (!existsSync(payloadRoot) || !statSync(payloadRoot).isDirectory()) fail(`missing payload directory: ${payloadRoot}`);
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) fail(`missing manifest: ${manifestPath}`);

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`manifest is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("manifest files must be a non-empty array");

  const seen = new Set();
  const results = manifest.files.map((entry, index) => {
    if (!entry || typeof entry !== "object") fail(`entry ${index} is not an object`);
    const manifestPathValue = safeRelativePath(entry.path);
    if (seen.has(manifestPathValue)) fail(`duplicate manifest path: ${manifestPathValue}`);
    seen.add(manifestPathValue);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) fail(`invalid size for ${manifestPathValue}`);
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) fail(`invalid SHA-256 for ${manifestPathValue}`);

    const filePath = pathWithinRoot(payloadRoot, manifestPathValue);
    if (!existsSync(filePath) || !lstatSync(filePath).isFile()) fail(`missing payload file: ${manifestPathValue}`);
    const bytes = readFileSync(filePath);
    const actualHash = sha256(bytes);
    if (bytes.length !== entry.size) fail(`size mismatch for ${manifestPathValue}: expected ${entry.size}, actual ${bytes.length}`);
    if (actualHash !== entry.sha256.toLowerCase()) fail(`SHA-256 mismatch for ${manifestPathValue}: expected ${entry.sha256}, actual ${actualHash}`);
    return { path: manifestPathValue, size: bytes.length, sha256: actualHash };
  });
  return { count: results.length, results };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payloadRoot = resolve(process.argv[2] ?? join(projectRoot, "windows-installer", "assets", "pos"));
  const manifestPath = resolve(process.argv[3] ?? join(projectRoot, "windows-installer", "assets", "pos-manifest.json"));
  try {
    const result = validatePosManifest({ payloadRoot, manifestPath });
    console.log(`POS manifest integrity PASS: ${result.count} files validated`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
