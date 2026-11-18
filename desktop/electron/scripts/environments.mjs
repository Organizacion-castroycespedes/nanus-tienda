export const ENVIRONMENTS = {
  dev: {
    name: "dev",
    agentPackageProfile: "dev",
    agentRealAdaptersEnabled: true,
    agentDiscoveryOnStartupEnabled: true,
    frontendUrl: "http://localhost:3000/login",
    origin: "http://localhost:3000",
  },
  qa: {
    name: "qa",
    agentPackageProfile: "qa",
    agentRealAdaptersEnabled: true,
    agentDiscoveryOnStartupEnabled: false,
    frontendUrl: "https://www.apptiendamanus.space/login",
    origin: "https://www.apptiendamanus.space",
    agentApiBaseUrl: "https://api.apptiendamanus.space/api",
    agentAudience: "manus-agent:qa",
  },
  production: {
    name: "production",
    agentPackageProfile: "production",
    agentRealAdaptersEnabled: true,
    agentDiscoveryOnStartupEnabled: true,
    frontendUrl: "https://portal.emaus.centrivosoft.com/login",
    origin: "https://portal.emaus.centrivosoft.com",
  },
};

export const getEnvironment = (name) => {
  const environment = ENVIRONMENTS[name];
  if (!environment) {
    throw new Error(`Unknown environment: ${name}. Use dev, qa, or production.`);
  }
  return environment;
};
