export const ENVIRONMENTS = {
  dev: {
    name: "dev",
    frontendUrl: "http://localhost:3000/login",
    origin: "http://localhost:3000",
  },
  qa: {
    name: "qa",
    frontendUrl: "https://www.apptiendamanus.space/login",
    origin: "https://www.apptiendamanus.space",
  },
  production: {
    name: "production",
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
