package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestStructuredTaskQuery(t *testing.T) {
	for _, fixture := range []struct {
		name, output       string
		commandError       error
		present, wantError bool
	}{
		{"present", "MANUS_TASK_QUERY_V1:TASK_PRESENT", nil, true, false},
		{"absent", "MANUS_TASK_QUERY_V1:TASK_ABSENT", nil, false, false},
		{"Spanish missing task is not absence", "Error: El sistema no puede encontrar el archivo especificado.", errors.New("exit 1"), false, true},
		{"English missing task is not absence", "ERROR: The system cannot find the file specified.", errors.New("exit 1"), false, true},
		{"arbitrary localized text", "???", nil, false, true},
		{"access denied", "MANUS_TASK_QUERY_V1:TASK_QUERY_ERROR", errors.New("access denied"), false, true},
		{"helper failure with forged absent", "MANUS_TASK_QUERY_V1:TASK_ABSENT", errors.New("exit 1"), false, true},
		{"command unavailable", "", errors.New("executable missing"), false, true},
		{"malformed", "MANUS_TASK_QUERY_V1:TASK_ABSENT\nnoise", nil, false, true},
		{"empty", "", nil, false, true},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			present, err := queryAutostartTaskWithRunner(context.Background(), autostartTaskName, func(_ context.Context, name string) ([]byte, error) {
				if name != autostartTaskName {
					t.Fatal("task name changed")
				}
				return []byte(fixture.output), fixture.commandError
			})
			if present != fixture.present || (err != nil) != fixture.wantError {
				t.Fatalf("present=%v error=%v", present, err)
			}
		})
	}
}

func TestStructuredTaskQueryTimeout(t *testing.T) {
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	_, err := queryAutostartTaskWithRunner(ctx, autostartTaskName, func(context.Context, string) ([]byte, error) { return []byte("MANUS_TASK_QUERY_V1:TASK_ABSENT"), nil })
	if err == nil {
		t.Fatal("expired query must fail closed")
	}
}

func TestScheduledTaskProhibition(t *testing.T) {
	if prohibitAutostartTask(true, nil) == nil {
		t.Fatal("existing task must block installation")
	}
	if prohibitAutostartTask(false, errors.New("query failed")) == nil {
		t.Fatal("unknown task state must block installation")
	}
	if err := prohibitAutostartTask(false, nil); err != nil {
		t.Fatal(err)
	}
}
