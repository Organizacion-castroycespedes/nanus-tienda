import { ServiceUnavailableException, Injectable, Inject, Optional } from "@nestjs/common";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { getAgentInstallationId } from "../../platform/agent-installation-state.store";
import { resolvePlatformPaths } from "../../platform/platform-paths";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import { decryptAgentCredentialEnvelope, enrollmentKeyFingerprint, verifyAgentSignedChallenge, type AgentSignedChallenge } from "./agent-pairing.crypto";
import { DpapiAgentSecretStore } from "./agent-secret.store";
import { isAllowedEnrollmentEndpoint } from "./agent-enrollment-endpoint";
import { LogsService } from "../logs/logs.service";
import { LogLevel } from "../../shared/types/peripheral.types";

type StoredAgentCredential = { credentialId: string; secret: string; expiresAt: string };
type SignedEnvelope = import("./agent-pairing.crypto").AgentCredentialEnvelope;
type RuntimeAuthConfig = { baseUrl: string };
type PairingTrustConfig = RuntimeAuthConfig & { publicPem: string; audience: string; keyId: string };

@Injectable()
export class AgentPairingService {
  private readonly store = new DpapiAgentSecretStore(resolvePlatformPaths().stateDir);
  private pending: { signedChallenge: AgentSignedChallenge; publicKeyPem: string; privateKeyPem: string } | null = null;
  private acceptingEnvelope = false;
  private readonly fallbackLogs = new LogsService();

  constructor(@Optional() @Inject(LogsService) private readonly logsService?: LogsService) {}

  private logs() { return this.logsService ?? this.fallbackLogs; }

  private runtimeAuthConfiguration(): RuntimeAuthConfig {
    const config = getPeripheralsConfig();
    const baseUrl = config.enrollmentApiBaseUrl?.trim();
    if (!baseUrl) throw new ServiceUnavailableException("AGENT_RUNTIME_AUTH_NOT_CONFIGURED");
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new ServiceUnavailableException("AGENT_RUNTIME_AUTH_NOT_CONFIGURED"); }
    if (!isAllowedEnrollmentEndpoint(url)) {
      throw new ServiceUnavailableException("AGENT_PAIRING_ENDPOINT_INVALID");
    }
    return { baseUrl: url.toString().replace(/\/$/, "") };
  }

  private pairingTrustConfiguration(): PairingTrustConfig {
    const runtime = this.runtimeAuthConfiguration();
    const config = getPeripheralsConfig();
    const publicPem = config.enrollmentSigningPublicKeyPem?.trim();
    const keyId = process.env.PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID?.trim();
    const audience = config.enrollmentAudience?.trim();
    if (!publicPem || !audience || !keyId) {
      throw new ServiceUnavailableException("AGENT_PAIRING_NOT_CONFIGURED");
    }
    let key;
    try {
      key = createPublicKey(publicPem);
    } catch {
      throw new ServiceUnavailableException("AGENT_PAIRING_TRUST_KEY_INVALID");
    }
    if (key.asymmetricKeyType !== "ed25519") {
      throw new ServiceUnavailableException("AGENT_PAIRING_TRUST_KEY_INVALID");
    }
    return { ...runtime, publicPem, audience, keyId };
  }

  private endpoint(base: string, route: string) { return `${base}/scale-authorization/${route}`; }

  private async restorePendingPairing() {
    if (this.pending) return this.pending;
    const bytes = await this.store.read("agent-pairing-pending");
    if (!bytes) return null;
    let saved: { signedChallenge: AgentSignedChallenge; publicKeyPem: string };
    try {
      saved = JSON.parse(bytes.toString("utf8")) as { signedChallenge: AgentSignedChallenge; publicKeyPem: string };
    } catch {
      this.store.delete("agent-pairing-pending");
      return null;
    } finally { bytes.fill(0); }
    const cfg = this.pairingTrustConfiguration();
    const keyPair = await this.enrollmentKey();
    const verified = verifyAgentSignedChallenge({ signed: saved.signedChallenge,
      trustedSigningPublicKeyPem: cfg.publicPem, expectedKeyId: cfg.keyId,
      expectedAudience: cfg.audience, expectedInstallationId: getAgentInstallationId(),
      enrollmentPublicKeyPem: keyPair.publicKeyPem });
    if (!verified || saved.publicKeyPem !== keyPair.publicKeyPem) {
      this.store.delete("agent-pairing-pending");
      return null;
    }
    this.pending = { signedChallenge: saved.signedChallenge, publicKeyPem: keyPair.publicKeyPem,
      privateKeyPem: keyPair.privateKeyPem };
    return this.pending;
  }

  private async enrollmentKey() {
    const stored = await this.store.read("agent-enrollment-key");
    if (stored) {
      try {
        const privateKeyPem = stored.toString("utf8");
        const privateKey = createPrivateKey(privateKeyPem);
        const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
        return { privateKeyPem, publicKeyPem };
      } finally { stored.fill(0); }
    }
    const pair = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
    const privateBytes = Buffer.from(pair.privateKey, "utf8");
    await this.store.write("agent-enrollment-key", privateBytes);
    return { privateKeyPem: pair.privateKey, publicKeyPem: pair.publicKey };
  }

  async startPairing() {
    const cfg = this.pairingTrustConfiguration();
    if (process.platform !== "win32") throw new ServiceUnavailableException("AGENT_DPAPI_REQUIRED");
    const restored = await this.restorePendingPairing();
    if (restored && Date.parse(restored.signedChallenge.challenge.expiresAt) > Date.now()) return this.status();
    this.pending = null;
    this.store.delete("agent-pairing-pending");
    if ((await this.status()).enrolled) throw new ServiceUnavailableException("AGENT_ALREADY_ENROLLED");
    const pair = await this.enrollmentKey();
    const nonce = randomBytes(32).toString("base64url");
    const response = await fetch(this.endpoint(cfg.baseUrl, "pairing/challenge"), {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ installationId: getAgentInstallationId(), nonce, enrollmentPublicKeyPem: pair.publicKeyPem }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ServiceUnavailableException("AGENT_PAIRING_CHALLENGE_FAILED");
    const signed = await response.json() as AgentSignedChallenge;
    const valid = verifyAgentSignedChallenge({ signed, trustedSigningPublicKeyPem: cfg.publicPem,
      expectedKeyId: cfg.keyId, expectedAudience: cfg.audience,
      expectedInstallationId: getAgentInstallationId(), enrollmentPublicKeyPem: pair.publicKeyPem });
    if (!valid) throw new ServiceUnavailableException("AGENT_PAIRING_CHALLENGE_UNTRUSTED");
    this.pending = { signedChallenge: signed, publicKeyPem: pair.publicKeyPem, privateKeyPem: pair.privateKeyPem };
    const pendingBytes = Buffer.from(JSON.stringify({ signedChallenge: signed, publicKeyPem: pair.publicKeyPem }), "utf8");
    await this.store.write("agent-pairing-pending", pendingBytes);
    return this.status();
  }

  async status() {
    // Pending enrollment state is exposed only when its signed challenge can
    // still be checked against the configured trust anchor. Existing runtime
    // credentials remain independently verifiable below.
    let pairing: ReturnType<AgentPairingService["pairingStatus"]> = null;
    try {
      this.pairingTrustConfiguration();
      await this.restorePendingPairing();
      pairing = this.pairingStatus();
    } catch {
      pairing = null;
    }
    const credentialBytes = await this.store.read("agent-credential");
    let enrolled = false;
    try {
      if (credentialBytes) {
        const stored = JSON.parse(credentialBytes.toString("utf8")) as StoredAgentCredential;
        if (Date.parse(stored.expiresAt) > Date.now()) {
          const cfg = this.runtimeAuthConfiguration();
          const authorization = `Agent ${stored.credentialId}.${stored.secret}`;
          const response = await fetch(this.endpoint(cfg.baseUrl, "agent/validate"), {
            method: "POST", headers: { authorization, accept: "application/json" },
            signal: AbortSignal.timeout(5_000),
          });
          enrolled = response.ok;
        }
      }
    } catch { enrolled = false; }
    finally { credentialBytes?.fill(0); }
    return {
      installationId: getAgentInstallationId(), enrolled,
      pairing,
    };
  }

  private pairingStatus() {
    return this.pending ? {
      pairingCode: this.pending.signedChallenge.challenge.pairingCode,
      signedChallenge: this.pending.signedChallenge,
      enrollmentPublicKeyPem: this.pending.publicKeyPem,
      expiresAt: this.pending.signedChallenge.challenge.expiresAt,
    } : null;
  }

  async acceptEnvelope(envelope: SignedEnvelope) {
    const cfg = this.pairingTrustConfiguration();
    const pending = this.pending;
    if (!pending || this.acceptingEnvelope) throw new ServiceUnavailableException("AGENT_PAIRING_NOT_PENDING");
    if (!envelope || typeof envelope !== "object"
      || Object.values(envelope).some((value) => typeof value !== "string" || value.length > 16_384)) {
      throw new ServiceUnavailableException("AGENT_ENVELOPE_INVALID");
    }
    const existingBytes = await this.store.read("agent-credential");
    if (existingBytes) {
      try {
        const existing = JSON.parse(existingBytes.toString("utf8")) as StoredAgentCredential;
        if (existing.credentialId === pending.signedChallenge.challenge.jti) {
          throw new ServiceUnavailableException("AGENT_PAIRING_ALREADY_CONSUMED");
        }
      } finally { existingBytes.fill(0); }
    }
    this.acceptingEnvelope = true;
    try {
    const credential = decryptAgentCredentialEnvelope({ envelope, challenge: pending.signedChallenge,
      enrollmentPrivateKeyPem: pending.privateKeyPem, trustedSigningPublicKeyPem: cfg.publicPem,
      expectedKeyId: cfg.keyId });
    try {
      const authorization = `Agent ${credential.credentialId}.${credential.secret.toString("utf8")}`;
      const response = await fetch(this.endpoint(cfg.baseUrl, "agent/validate"), {
        method: "POST", headers: { authorization, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new ServiceUnavailableException("AGENT_CREDENTIAL_REJECTED_BY_API");
      const payload = Buffer.from(JSON.stringify({ credentialId: credential.credentialId,
        secret: credential.secret.toString("utf8"), expiresAt: credential.expiresAt }), "utf8");
      await this.store.write("agent-credential", payload);
      this.pending = null;
      this.store.delete("agent-pairing-pending");
      return { enrolled: true, credentialId: credential.credentialId,
        keyFingerprint: pending.signedChallenge.challenge.enrollmentKeyFingerprint };
    } finally { credential.secret.fill(0); }
    } finally { this.acceptingEnvelope = false; }
  }

  async withAgentAuthorization<T>(operation: (authorization: string, baseUrl: string) => Promise<T>): Promise<T> {
    const cfg = this.runtimeAuthConfiguration();
    const stored = await this.store.read("agent-credential");
    if (!stored) throw new ServiceUnavailableException("AGENT_NOT_ENROLLED");
    try {
      const credential = JSON.parse(stored.toString("utf8")) as StoredAgentCredential;
      if (!credential.credentialId || Date.parse(credential.expiresAt) <= Date.now()) throw new ServiceUnavailableException("AGENT_CREDENTIAL_EXPIRED");
      return await operation(`Agent ${credential.credentialId}.${credential.secret}`, cfg.baseUrl);
    } finally { stored.fill(0); }
  }

  async submitRealObservation(input: { posTerminalId: string; logicalScaleId: string; source: string; unit: string | null; unitVerified: boolean; observedAt: string }) {
    return this.withAgentAuthorization(async (authorization, baseUrl) => {
      const response = await fetch(this.endpoint(baseUrl, "agent/readiness"), {
        method: "POST", headers: { authorization, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new ServiceUnavailableException("AGENT_READINESS_REQUEST_FAILED");
      return response.json();
    });
  }

  async submitSaleCaptureObservation(input: { captureId: string; deviceId: string; weight: number; unit: string | null; source: string; unitVerified: boolean; observedAt: string }) {
    return this.withAgentAuthorization(async (authorization, baseUrl) => {
      this.logs().append({ source: "scale", event: "capture.observation_send_started",
        message: "Sending authenticated scale observation to API", metadata: { captureId: input.captureId, stage: "observation_send" } });
      let response: Response;
      try {
        response = await fetch(this.endpoint(baseUrl, "agent/weight-captures/observation"), {
          method: "POST", headers: { authorization, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(input), signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        this.logs().append({ level: LogLevel.ERROR, source: "scale", event: "capture.failed",
          message: "Authenticated scale observation request failed", metadata: {
            captureId: input.captureId, stage: "observation_send",
            errorCode: name === "TimeoutError" || name === "AbortError" ? "OBSERVATION_NETWORK_TIMEOUT" : "OBSERVATION_NETWORK_ERROR",
          } });
        throw error;
      }
      if (!response.ok) {
        const statusClass = response.status >= 500 ? "5XX" : response.status >= 400 ? "4XX" : "NON_SUCCESS";
        this.logs().append({ level: LogLevel.WARN, source: "scale", event: "capture.observation_response_received",
          message: "API rejected authenticated scale observation", metadata: {
            captureId: input.captureId, stage: "observation_response", httpStatus: response.status,
            errorCode: `OBSERVATION_API_HTTP_${statusClass}`,
          } });
        this.logs().append({ level: LogLevel.ERROR, source: "scale", event: "capture.failed",
          message: "API rejected authenticated scale observation", metadata: {
            captureId: input.captureId, stage: "observation_response", httpStatus: response.status,
            errorCode: `OBSERVATION_API_HTTP_${statusClass}`,
          } });
        throw new ServiceUnavailableException("AGENT_CAPTURE_OBSERVATION_REQUEST_FAILED");
      }
      this.logs().append({ source: "scale", event: "capture.observation_response_received",
        message: "API accepted authenticated scale observation request", metadata: {
          captureId: input.captureId, stage: "observation_response", httpStatus: response.status,
        } });
      let result: unknown;
      try {
        result = await response.json();
      } catch (error) {
        this.logs().append({ level: LogLevel.ERROR, source: "scale", event: "capture.failed",
          message: "API observation response was not valid JSON", metadata: {
            captureId: input.captureId, stage: "observation_response", httpStatus: response.status,
            errorCode: "OBSERVATION_RESPONSE_INVALID",
          } });
        throw error;
      }
      if (result && typeof result === "object" && "status" in result && result.status === "READY") {
        this.logs().append({ source: "scale", event: "capture.ready_confirmed",
          message: "API confirmed commercial scale capture READY", metadata: { captureId: input.captureId, stage: "ready" } });
      }
      return result;
    });
  }

  forgetEnrollment() {
    this.store.delete("agent-credential");
    this.pending = null;
    return { enrolled: false };
  }
}
