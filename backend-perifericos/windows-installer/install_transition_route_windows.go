package main

import "fmt"

// routeInstallTransition is the single lifecycle call site for UPDATE. P0-B
// classification is unchanged: only an UNKNOWN/transition_unproven rejection is
// considered, and while installTransitionExecutionEnabled is false or
// approvedInstallTransitions is empty the original rejection is returned
// unchanged, with no observation and no effect.
//
// The enabled branch still fails closed: the native 14.4a evidence observer
// (installed and candidate payload digests, candidate artifact SHA-256 and the
// QA environment digest contract) is not implemented, so no update can be
// admitted from here. 14.4c must certify the whole path before any allowlist
// entry is added.
func routeInstallTransition(m installerManifest, l runtimeLayout, admission installAdmissionDecision, admissionErr error) error {
	if admissionErr == nil || admission.State != installAdmissionUnknown || admission.Reason != "transition_unproven" {
		return admissionErr
	}
	if !installTransitionExecutionEnabled || len(approvedInstallTransitions) == 0 {
		return admissionErr
	}
	return fmt.Errorf("%w; update_routing_unavailable: native transition evidence observer not implemented", admissionErr)
}
