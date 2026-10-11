import { resolve } from "node:path";

export type EnrollmentEndpointRuntime = {
  nodeEnv?: string;
  allowLoopbackHttp?: string;
  argv?: string[];
  cwd?: string;
};

/**
 * Remote Agent enrollment always uses HTTPS. Plain HTTP is allowed only for an
 * explicitly opted-in tsx source-development process and exact loopback hosts.
 * The source-entry check prevents the opt-in from affecting packaged builds.
 */
export const isAllowedEnrollmentEndpoint = (
  url: URL,
  runtime: EnrollmentEndpointRuntime = {
    nodeEnv: process.env.NODE_ENV,
    allowLoopbackHttp: process.env.PERIPHERALS_ENROLLMENT_ALLOW_LOOPBACK_HTTP,
    argv: process.argv,
    cwd: process.cwd(),
  },
): boolean => {
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;

  const sourceEntry = resolve(runtime.cwd ?? process.cwd(), "src", "main.ts");
  const isSourceDevelopmentRuntime = (runtime.argv ?? process.argv)
    .some((argument) => resolve(argument) === sourceEntry);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

  return runtime.nodeEnv === "development"
    && runtime.allowLoopbackHttp === "true"
    && isSourceDevelopmentRuntime
    && loopbackHosts.has(url.hostname);
};
