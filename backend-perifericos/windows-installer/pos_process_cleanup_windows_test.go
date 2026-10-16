//go:build windows

package main

import (
	"errors"
	"testing"
	"time"
)

type fakePOSProcessHandle struct {
	path       string
	identity   uint64
	pathErr    error
	identityErr error
	terminate  error
	waitExited bool
	waitErr    error
	terminated bool
}

func (h *fakePOSProcessHandle) ImagePath() (string, error) { return h.path, nil }
func (h *fakePOSProcessHandle) Identity() (uint64, error)  { return h.identity, nil }
func (h *fakePOSProcessHandle) Terminate() error {
	h.terminated = true
	return h.terminate
}
func (h *fakePOSProcessHandle) Wait(time.Duration) (bool, error) { return h.waitExited, h.waitErr }
func (h *fakePOSProcessHandle) Close()                           {}

type fakePOSProcessOperations struct {
	discovered      []scopedPOSProcess
	discoverResults [][]scopedPOSProcess
	discoverCalls   int
	opened          map[uint32]scopedPOSProcessHandle
	openErr         map[uint32]error
	opens           []uint32
}

func (f *fakePOSProcessOperations) Discover(string) ([]scopedPOSProcess, error) {
	index := f.discoverCalls
	f.discoverCalls++
	if index < len(f.discoverResults) {
		return append([]scopedPOSProcess(nil), f.discoverResults[index]...), nil
	}
	return append([]scopedPOSProcess(nil), f.discovered...), nil
}

func (f *fakePOSProcessOperations) Open(process scopedPOSProcess) (scopedPOSProcessHandle, error) {
	f.opens = append(f.opens, process.pid)
	if err := f.openErr[process.pid]; err != nil {
		return nil, err
	}
	return f.opened[process.pid], nil
}

func TestCloseScopedPOSProcessesTreatsVanishedPIDAsBenign(t *testing.T) {
	fake := &fakePOSProcessOperations{
		discoverResults: [][]scopedPOSProcess{
			{{pid: 10, path: "C:\\POS\\versions\\0.1.0\\Manus POS.exe"}},
			{},
		},
		openErr: map[uint32]error{10: errPOSProcessGone},
		opened:  map[uint32]scopedPOSProcessHandle{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err != nil {
		t.Fatalf("vanished process should be benign: %v", err)
	}
}

func TestCloseScopedPOSProcessesRejectsReusedPIDOutsideRoot(t *testing.T) {
	handle := &fakePOSProcessHandle{path: "C:\\Other\\electron.exe", identity: 2}
	fake := &fakePOSProcessOperations{
		discoverResults: [][]scopedPOSProcess{
			{{pid: 11, path: "C:\\POS\\Manus POS.exe", identity: 1}},
			{},
		},
		opened:  map[uint32]scopedPOSProcessHandle{11: handle},
		openErr: map[uint32]error{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err != nil {
		t.Fatalf("out-of-scope PID reuse should be skipped: %v", err)
	}
	if handle.terminated {
		t.Fatal("out-of-scope reused PID was terminated")
	}
}

func TestCloseScopedPOSProcessesReportsAccessDenied(t *testing.T) {
	handle := &fakePOSProcessHandle{path: "C:\\POS\\Manus POS.exe", identity: 1, terminate: errors.New("access denied")}
	fake := &fakePOSProcessOperations{
		discovered: []scopedPOSProcess{{pid: 12, path: "C:\\POS\\Manus POS.exe", identity: 1}},
		opened:     map[uint32]scopedPOSProcessHandle{12: handle},
		openErr:    map[uint32]error{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err == nil {
		t.Fatal("access denied termination must fail")
	}
}

func TestCloseScopedPOSProcessesReportsSurvivingProcess(t *testing.T) {
	handle := &fakePOSProcessHandle{path: "C:\\POS\\Manus POS.exe", identity: 1, waitExited: false}
	fake := &fakePOSProcessOperations{
		discovered: []scopedPOSProcess{{pid: 13, path: "C:\\POS\\Manus POS.exe", identity: 1}},
		opened:     map[uint32]scopedPOSProcessHandle{13: handle},
		openErr:    map[uint32]error{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err == nil {
		t.Fatal("surviving process must fail cleanup")
	}
}

func TestCloseScopedPOSProcessesTreatsTerminateRaceAsBenign(t *testing.T) {
	handle := &fakePOSProcessHandle{path: "C:\\POS\\Manus POS.exe", identity: 1, terminate: errPOSProcessGone}
	fake := &fakePOSProcessOperations{
		discoverResults: [][]scopedPOSProcess{
			{{pid: 14, path: "C:\\POS\\Manus POS.exe", identity: 1}},
			{},
		},
		opened:  map[uint32]scopedPOSProcessHandle{14: handle},
		openErr: map[uint32]error{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err != nil {
		t.Fatalf("already-exited termination should be benign: %v", err)
	}
}
func TestCloseScopedPOSProcessesRejectsChangedIdentityInsideRoot(t *testing.T) {
	handle := &fakePOSProcessHandle{path: "C:\\POS\\other.exe", identity: 2}
	fake := &fakePOSProcessOperations{
		discoverResults: [][]scopedPOSProcess{
			{{pid: 15, path: "C:\\POS\\Manus POS.exe", identity: 1}},
			{},
		},
		opened:  map[uint32]scopedPOSProcessHandle{15: handle},
		openErr: map[uint32]error{},
	}
	if err := closeScopedPOSProcessesWith("C:\\POS", nil, fake); err != nil {
		t.Fatalf("changed identity inside root should be skipped safely: %v", err)
	}
	if handle.terminated {
		t.Fatal("changed identity was terminated")
	}
}
