import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type { ElectronicBillingOperationalApproval } from "./electronic-billing-write-readiness";

type ApprovalRow = {
  key_owner_identity: string;
  recovery_verifier_identity: string;
  approval_identity: string;
  evidence_reference: string;
  evidence_fingerprint: string;
  evidence_verification_status: string;
  recovery_verification_status: string;
  recovery_verified_at: string;
  approved_at: string;
  expires_at: string;
  status: string;
  revoked_at: string | null;
};

const UNKNOWN_APPROVAL: ElectronicBillingOperationalApproval = {
  operationalOwnership: "UNKNOWN",
  recoveryReadiness: "UNKNOWN",
};

const isVerifiedRow = (row: ApprovalRow, now: number) => {
  const identities = [row.key_owner_identity, row.recovery_verifier_identity, row.approval_identity];
  return row.status === "APPROVED"
    && row.revoked_at === null
    && row.evidence_verification_status === "VERIFIED"
    && row.recovery_verification_status === "VERIFIED"
    && identities.every((value) => typeof value === "string" && value.trim().length > 0)
    && new Set(identities).size === identities.length
    && typeof row.evidence_reference === "string"
    && row.evidence_reference.trim().length > 0
    && /^[0-9a-f]{64}$/i.test(row.evidence_fingerprint)
    && Date.parse(row.recovery_verified_at) <= Date.parse(row.approved_at)
    && Date.parse(row.expires_at) > now;
};

@Injectable()
export class DatabaseElectronicBillingOperationalApproval {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getApproval(): Promise<ElectronicBillingOperationalApproval> {
    const activeKeyId = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID?.trim();
    if (!activeKeyId) return UNKNOWN_APPROVAL;

    try {
      const result = await this.db.query<ApprovalRow>(
        `SELECT key_owner_identity, recovery_verifier_identity, approval_identity,
                evidence_reference, evidence_fingerprint, evidence_verification_status,
                recovery_verification_status, recovery_verified_at, approved_at,
                expires_at, status, revoked_at
           FROM public.electronic_billing_keyring_operational_approvals
          WHERE target_environment = 'QA'
            AND active_key_id = $1
            AND expires_at > NOW()
          ORDER BY approved_at DESC
          LIMIT 2`,
        [activeKeyId],
      );
      const validRows = result.rows.filter((row) => isVerifiedRow(row, Date.now()));
      if (validRows.length !== 1) return UNKNOWN_APPROVAL;
      return { operationalOwnership: "APPROVED", recoveryReadiness: "APPROVED" };
    } catch {
      return UNKNOWN_APPROVAL;
    }
  }
}
