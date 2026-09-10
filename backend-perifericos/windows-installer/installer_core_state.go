//go:build windows

package main

// installerCorePhase is the typed protocol boundary between Installer Core
// and the future productive WebView2 UI. It is intentionally independent from
// the installation implementation so no progress is fabricated by JavaScript.
type installerCorePhase string

const (
	coreNotStarted installerCorePhase = "NOT_STARTED"
	coreRunning    installerCorePhase = "RUNNING"
	coreCompleted  installerCorePhase = "COMPLETED"
	coreFailedSafe installerCorePhase = "FAILED_SAFE"
)

type installerCoreStepState string

type installerCoreStepID string

const (
	stepVerifyRequirements installerCoreStepID = "VERIFY_REQUIREMENTS"
	stepPrepareFiles       installerCoreStepID = "PREPARE_FILES"
	stepInstallAgent       installerCoreStepID = "INSTALL_AGENT"
	stepConfigureService   installerCoreStepID = "CONFIGURE_SERVICE"
	stepStartService       installerCoreStepID = "START_SERVICE"
	stepVerifyService      installerCoreStepID = "VERIFY_SERVICE"
	stepDiscoverDevices    installerCoreStepID = "DISCOVER_DEVICES"
	stepConfigureDevices   installerCoreStepID = "CONFIGURE_DEVICES"
	stepFinalize           installerCoreStepID = "FINALIZE_INSTALLATION"
	stepRollback           installerCoreStepID = "ROLLBACK"
)

type installerCoreEventType string

const (
	eventInstallStarted  installerCoreEventType = "INSTALL_STARTED"
	eventStepStarted     installerCoreEventType = "STEP_STARTED"
	eventStepSucceeded   installerCoreEventType = "STEP_SUCCEEDED"
	eventStepWarning     installerCoreEventType = "STEP_WARNING"
	eventStepFailed      installerCoreEventType = "STEP_FAILED"
	eventRollbackStarted installerCoreEventType = "ROLLBACK_STARTED"
	eventRollbackSuccess installerCoreEventType = "ROLLBACK_SUCCEEDED"
	eventRollbackFailed  installerCoreEventType = "ROLLBACK_FAILED"
	eventInstallSuccess  installerCoreEventType = "INSTALL_SUCCEEDED"
	eventInstallFailed   installerCoreEventType = "INSTALL_FAILED"
)

const (
	coreStepPending installerCoreStepState = "PENDING"
	coreStepRunning installerCoreStepState = "RUNNING"
	coreStepSuccess installerCoreStepState = "SUCCESS"
	coreStepWarning installerCoreStepState = "WARNING"
	coreStepError   installerCoreStepState = "ERROR"
	coreStepSkipped installerCoreStepState = "SKIPPED"
)

type installerCoreStep struct {
	ID         installerCoreStepID    `json:"id"`
	Name       string                 `json:"name"`
	State      installerCoreStepState `json:"state"`
	DurationMs int64                  `json:"durationMs,omitempty"`
	Message    string                 `json:"message,omitempty"`
}

type installerCoreState struct {
	Sequence       uint64              `json:"sequence"`
	Phase          installerCorePhase  `json:"phase"`
	Progress       int                 `json:"progress"`
	Steps          []installerCoreStep `json:"steps"`
	CurrentStep    string              `json:"currentStep,omitempty"`
	Warning        string              `json:"warning,omitempty"`
	Error          string              `json:"error,omitempty"`
	TechnicalError string              `json:"technicalError,omitempty"`
	CanCancel      bool                `json:"canCancel"`
	lastSequence   uint64
}

type installerCoreEvent struct {
	Sequence  uint64                 `json:"sequence"`
	Timestamp string                 `json:"timestamp"`
	Type      installerCoreEventType `json:"type"`
	StepID    installerCoreStepID    `json:"stepId,omitempty"`
	State     installerCoreStepState `json:"state,omitempty"`
	Progress  int                    `json:"progress"`
	Message   string                 `json:"message,omitempty"`
	ErrorCode string                 `json:"errorCode,omitempty"`
	SafeError string                 `json:"safeError,omitempty"`
	Retryable bool                   `json:"retryable,omitempty"`
}

func productiveCoreSteps() []installerCoreStep {
	names := []string{"Verificando requisitos del sistema", "Preparando archivos de instalación", "Instalando Manus Peripheral Agent", "Configurando servicio Manus", "Iniciando servicio Manus", "Verificando servicio Manus", "Detectando dispositivos", "Configurando periféricos", "Finalizando instalación"}
	steps := make([]installerCoreStep, len(names))
	for i, name := range names {
		ids := []installerCoreStepID{stepVerifyRequirements, stepPrepareFiles, stepInstallAgent, stepConfigureService, stepStartService, stepVerifyService, stepDiscoverDevices, stepConfigureDevices, stepFinalize}
		steps[i] = installerCoreStep{ID: ids[i], Name: name, State: coreStepPending}
	}
	return steps
}

func newInstallerCoreState() installerCoreState {
	return installerCoreState{Phase: coreNotStarted, Steps: productiveCoreSteps(), CanCancel: true}
}
