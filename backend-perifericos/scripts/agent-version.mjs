export const QA_AGENT_VERSION = "0.1.1-qa.13";

export const resolveAgentVersion = ({
  packageVersion,
  environment = process.env.MANUS_ENVIRONMENT,
  requestedVersion = process.env.MANUS_AGENT_VERSION,
}) => {
  const requested = requestedVersion?.trim();

  if (environment === "qa") {
    if (requested && requested !== QA_AGENT_VERSION) {
      throw new Error(
        `QA Agent version must be ${QA_AGENT_VERSION}; received ${requested}`,
      );
    }
    return QA_AGENT_VERSION;
  }

  if (environment === "production") {
    if (requested && requested !== packageVersion) {
      throw new Error(
        `Production Agent version must remain ${packageVersion}; received ${requested}`,
      );
    }
    return packageVersion;
  }

  return requested || packageVersion;
};
