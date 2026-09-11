## 1. Inventory

- [ ] 1.1 Identify exposed database credentials.
- [ ] 1.2 Classify environment and ownership.
- [ ] 1.3 Determine active/inactive status.

## 2. Database credential rotation

- [ ] 2.1 Rotate active exposed QA DB credentials.
- [ ] 2.2 Update local untracked configuration.
- [ ] 2.3 Validate new credentials.
- [ ] 2.4 Verify old credentials revoked where possible.

## 3. PKCS#12 investigation

- [ ] 3.1 Determine whether exposed PKCS#12 contains a private key.
- [ ] 3.2 Determine certificate purpose and environment.
- [ ] 3.3 Determine whether the certificate is active.

## 4. Certificate remediation

- [ ] 4.1 Replace or reissue the certificate if required.
- [ ] 4.2 Revoke exposed certificate/private key if applicable.
- [ ] 4.3 Update local runtime configuration.
- [ ] 4.4 Validate signing configuration without fiscal transmission.

## 5. Git history analysis

- [ ] 5.1 Identify all affected blobs.
- [ ] 5.2 Identify affected branches.
- [ ] 5.3 Identify affected tags.
- [ ] 5.4 Identify remote refs.
- [ ] 5.5 Define clone and CI coordination plan.

## 6. History purge

- [ ] 6.1 Create repository backup.
- [ ] 6.2 Execute approved history rewrite.
- [ ] 6.3 Validate rewritten local history.
- [ ] 6.4 Coordinate remote force-with-lease updates.
- [ ] 6.5 Refresh affected clones and worktrees.

## 7. Verification

- [ ] 7.1 Confirm secrets absent from intended reachable history.
- [ ] 7.2 Confirm current tree remains secret-free.
- [ ] 7.3 Run API tests.
- [ ] 7.4 Run Billing tests.
- [ ] 7.5 Run Web build.
- [ ] 7.6 Run Electron tests/build.
- [ ] 7.7 Run OpenSpec strict.
- [ ] 7.8 Run secret scan.

## 8. Closure

- [ ] 8.1 Document rotated/revoked credentials.
- [ ] 8.2 Document certificate disposition.
- [ ] 8.3 Document history rewrite evidence.
- [ ] 8.4 Close security technical debt.

