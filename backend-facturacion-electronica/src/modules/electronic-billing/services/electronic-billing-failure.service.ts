import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import {
  buildResolutionCandidates,
  isFailureStatus,
  resolveErrorFailureClass,
  resolveOutcomeFailureClass,
  type ElectronicDocumentOutcome,
  type ElectronicDocumentOutcomeFailure,
  type ElectronicFailureDetailInput,
} from "../domain/electronic-billing-failure";
import type { ElectronicDocumentRecord } from "../repositories/electronic-billing-records";
import { ElectronicDocumentRepository } from "../repositories/electronic-billing.repositories";
import { ElectronicDocumentFailureRepository } from "../repositories/electronic-document-failure.repository";

const FAILURE_DETAILS_SAVEPOINT = "electronic_failure_details";

const readDbErrorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : null;

@Injectable()
export class ElectronicBillingFailureService {
  constructor(
    @Inject(ElectronicDocumentRepository)
    private readonly documentRepository: ElectronicDocumentRepository,
    @Inject(ElectronicDocumentFailureRepository)
    private readonly failureRepository: ElectronicDocumentFailureRepository,
  ) {}

  /**
   * Runs inside the caller transaction. Failure detail storage never aborts
   * fiscal state persistence (for example when V096 was not applied yet).
   */
  async recordFailureDetails(
    client: PoolClient,
    tenantId: string,
    electronicDocumentId: string,
    attempt: number,
    details: ElectronicFailureDetailInput[],
  ) {
    if (details.length === 0) {
      return;
    }

    await client.query(`SAVEPOINT ${FAILURE_DETAILS_SAVEPOINT}`);
    try {
      await this.failureRepository.insertMany(tenantId, electronicDocumentId, attempt, details, client);
      await client.query(`RELEASE SAVEPOINT ${FAILURE_DETAILS_SAVEPOINT}`);
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT ${FAILURE_DETAILS_SAVEPOINT}`);
      console.warn("electronic_billing.failure_details.persist_failed", {
        tenantId,
        electronicDocumentId,
        dbErrorCode: readDbErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async describe(tenantId: string, electronicDocumentId: string): Promise<ElectronicDocumentOutcome | null> {
    const document = await this.documentRepository.findById(tenantId, electronicDocumentId);
    if (!document) {
      return null;
    }
    return this.describeDocument(document);
  }

  async describeDocument(document: ElectronicDocumentRecord): Promise<ElectronicDocumentOutcome> {
    const failures = isFailureStatus(document.status) ? await this.loadFailures(document) : [];
    const failureClass = resolveOutcomeFailureClass(document.status, failures.map((item) => item.failureClass));
    const retryable = failureClass === "NETWORK_OR_TRANSIENT" || failureClass === "PENDING";

    return {
      electronicDocumentId: document.id,
      documentType: document.document_type,
      status: document.status,
      fullNumber: document.full_number,
      cufe: document.cufe,
      cude: document.cude,
      providerStatus: document.provider_status,
      failureClass,
      retryable,
      errorCode: document.status === "ACCEPTED" ? null : document.last_error_code,
      errorMessage: document.status === "ACCEPTED" ? null : document.last_error_message,
      failures: failures.map(({ failureClass: _failureClass, ...failure }) => failure),
    };
  }

  private async loadFailures(document: ElectronicDocumentRecord) {
    type LoadedFailure = ElectronicDocumentOutcomeFailure & {
      failureClass: Parameters<typeof resolveOutcomeFailureClass>[1][number];
    };

    try {
      const rows = await this.failureRepository.findLatestAttempt(document.tenant_id, document.id);
      if (rows.length > 0) {
        return rows.map((row): LoadedFailure => ({
          code: row.code,
          message: row.message,
          origin: row.origin,
          path: row.path,
          severity: row.severity,
          title: row.resolution_title,
          solution: row.resolution_solution,
          retryable: row.resolution_retryable ?? row.failure_class === "NETWORK_OR_TRANSIENT",
          failureClass: row.failure_class,
        }));
      }
    } catch (error) {
      console.warn("electronic_billing.failure_details.read_failed", {
        tenantId: document.tenant_id,
        electronicDocumentId: document.id,
        dbErrorCode: readDbErrorCode(error),
      });
    }

    if (!document.last_error_code && !document.last_error_message && !document.provider_status_detail) {
      return [];
    }

    const message = document.last_error_message ?? document.provider_status_detail ?? "Error sin detalle";
    let resolution = null;
    try {
      resolution = await this.failureRepository.findResolution(
        buildResolutionCandidates(document.last_error_code, message),
      );
    } catch {
      resolution = null;
    }

    return [{
      code: document.last_error_code,
      message,
      origin: resolution?.origin ?? "FACTUCORE",
      path: null,
      severity: null,
      title: resolution?.title ?? null,
      solution: resolution?.solution_text ?? null,
      retryable: resolution?.retryable ?? document.status === "TECHNICAL_ERROR",
      failureClass: document.status === "REJECTED" && !(document.last_error_code ?? "").startsWith("FACTUCORE")
        ? "DIAN_REJECTED"
        : resolveErrorFailureClass(document.last_error_code ?? "", {
            rejected: document.status === "REJECTED",
            retryable: resolution?.retryable ?? document.status === "TECHNICAL_ERROR",
          }),
    } satisfies LoadedFailure];
  }
}
