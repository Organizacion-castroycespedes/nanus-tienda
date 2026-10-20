package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// Enumerate successfully before declaring absence. Human error text is never
// evidence of absence, including when PowerShell or its module is unavailable.
const taskQueryScript = `$ErrorActionPreference='Stop'; try { $tasks=@(Get-ScheduledTask -ErrorAction Stop); $found=@($tasks | Where-Object { $_.TaskPath -eq '\' -and $_.TaskName -eq $env:MANUS_TASK_QUERY_NAME }); if ($found.Count -gt 0) { [Console]::Out.Write('MANUS_TASK_QUERY_V1:TASK_PRESENT') } else { [Console]::Out.Write('MANUS_TASK_QUERY_V1:TASK_ABSENT') }; exit 0 } catch { [Console]::Out.Write('MANUS_TASK_QUERY_V1:TASK_QUERY_ERROR'); exit 1 }`

type taskQueryRunner func(context.Context, string) ([]byte, error)

func prohibitAutostartTask(present bool, err error) error {
	if err != nil {
		return err
	}
	if present {
		return errors.New("Manus Peripheral Agent Scheduled Task exists; remove or review it manually before service installation")
	}
	return nil
}

func runTaskQuery(ctx context.Context, name string) ([]byte, error) {
	command := exec.CommandContext(ctx, filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), "-NoProfile", "-NonInteractive", "-Command", taskQueryScript)
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	command.Env = append(os.Environ(), "MANUS_TASK_QUERY_NAME="+name)
	return command.Output()
}

func queryAutostartTask(name string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return queryAutostartTaskWithRunner(ctx, name, runTaskQuery)
}

func queryAutostartTaskWithRunner(ctx context.Context, name string, runner taskQueryRunner) (bool, error) {
	output, err := runner(ctx, name)
	if err != nil || ctx.Err() != nil {
		return false, errors.New("scheduled task query failed: TASK_QUERY_ERROR")
	}
	switch strings.TrimSpace(string(output)) {
	case "MANUS_TASK_QUERY_V1:TASK_PRESENT":
		return true, nil
	case "MANUS_TASK_QUERY_V1:TASK_ABSENT":
		return false, nil
	default:
		return false, errors.New("scheduled task query failed: invalid structured response")
	}
}
