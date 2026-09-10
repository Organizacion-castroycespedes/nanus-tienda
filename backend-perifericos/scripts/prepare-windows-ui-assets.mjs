import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "installer-ui");
const target = join(root, "windows-installer", "assets", "ui");
mkdirSync(target, { recursive: true });
const sourceHtml = readFileSync(join(source, "index.html"), "utf8");
const css = readFileSync(join(source, "styles.css"), "utf8");
const js = readFileSync(join(source, "app.js"), "utf8");
const logoPath = join(root, "..", "web", "public", "LogoManus.png.jpeg");
if (!existsSync(logoPath)) throw new Error(`Missing Manus logo source: ${logoPath}`);
const logoDataUri = `data:image/jpeg;base64,${readFileSync(logoPath).toString("base64")}`;
const buildRuntimeHtml = ({ showMockNav }) => {
  let html = sourceHtml;
  html = html.replace(/<link[^>]+href=["']styles\.css["'][^>]*>/i, `<style>${css}</style>`);
  html = html.replace(/<script[^>]+src=["']app\.js["'][^>]*><\/script>/i, `<script>${js}</script>`);
  html = html.replaceAll("../../web/public/LogoManus.png.jpeg", logoDataUri);
  const runtimeCss = `<style data-manus-runtime="true">\n.window-bar{display:none!important;}\n${showMockNav ? "" : ".prototype-nav{display:none!important;}"}\n</style>`;
  html = html.replace("</head>", `${runtimeCss}</head>`);
  if (/src=["']app\.js["']|href=["']styles\.css["']|(?:src|href)=["'][^"']*LogoManus\.png\.jpeg|file:\/\/|https?:\/\//i.test(html)) {
    throw new Error("runtime UI HTML contains unresolved or remote assets");
  }
  return html;
};
writeFileSync(join(target, "index.runtime.html"), buildRuntimeHtml({ showMockNav: true }), "utf8");
writeFileSync(join(target, "index.runtime.productive.html"), buildRuntimeHtml({ showMockNav: false }), "utf8");
for (const name of ["index.html", "styles.css", "app.js"]) {
  if (!existsSync(join(source, name))) throw new Error(`Missing source UI asset: ${name}`);
}
console.log(`Runtime UI asset prepared: ${join(target, "index.runtime.html")}`);
