//go:build windows

package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"os"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	mutexModifyState = 0x00000001
	readControl      = 0x00020000
	synchronize      = 0x00100000
	waitObject0      = 0x00000000
	waitAbandoned    = 0x00000080
	waitTimeout      = 0x00000102
	waitFailed       = 0xffffffff
)

type mutexSecurityAttributes struct {
	length             uint32
	securityDescriptor uintptr
	inheritHandle      int32
}

var (
	advapi32                        = syscall.NewLazyDLL("advapi32.dll")
	kernel32                        = syscall.NewLazyDLL("kernel32.dll")
	convertStringSecurityDescriptor = advapi32.NewProc("ConvertStringSecurityDescriptorToSecurityDescriptorW")
	createMutexEx                   = kernel32.NewProc("CreateMutexExW")
	waitForSingleObject             = kernel32.NewProc("WaitForSingleObject")
	releaseMutex                    = kernel32.NewProc("ReleaseMutex")
	closeHandle                     = kernel32.NewProc("CloseHandle")
	localFree                       = kernel32.NewProc("LocalFree")
)

type mutexCommand struct {
	kind  string
	token string
}

// runSecureSecretMutex is deliberately a mode of the already supervised
// Windows service executable. It is not a second service. The mutex is owned
// and released by this locked OS thread only.
func runSecureSecretMutex(args []string) error {
	set := flag.NewFlagSet("secure-secret-mutex", flag.ContinueOnError)
	set.SetOutput(os.Stderr)
	name := set.String("mutex-name", "", "validated Local mutex name")
	operationID := set.String("operation-id", "", "diagnostic operation id")
	waitMS := set.Uint("wait-ms", 10000, "acquisition timeout")
	parentPID := set.Int("parent-pid", os.Getppid(), "owning client pid")
	if err := set.Parse(args); err != nil {
		return err
	}
	if !strings.HasPrefix(*name, `Local\ManusPeripheralAgent-`) || len(*name) > 260 {
		return errors.New("invalid secure mutex name")
	}
	if *operationID == "" || len(*operationID) > 128 || *parentPID <= 0 || *waitMS > 120000 {
		return errors.New("invalid secure mutex arguments")
	}

	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	handle, descriptor, err := createRestrictedMutex(*name)
	if err != nil {
		return fmt.Errorf("create secure mutex: %w", err)
	}
	defer closeMutex(handle, descriptor)

	wait, _, callErr := waitForSingleObject.Call(handle, uintptr(*waitMS))
	switch uint32(wait) {
	case waitTimeout:
		fmt.Fprintf(os.Stdout, "TIMEOUT %s\n", *operationID)
		return nil
	case waitAbandoned:
		fmt.Fprintf(os.Stdout, "ABANDONED %s\n", *operationID)
		return nil
	case waitFailed:
		return fmt.Errorf("WaitForSingleObject failed: %w", callErr)
	case waitObject0:
	default:
		return fmt.Errorf("unexpected wait result: 0x%x", wait)
	}

	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		return fmt.Errorf("create mutex operation token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)
	fmt.Fprintf(os.Stdout, "ACQUIRED %s %s\n", *operationID, token)

	commands := make(chan mutexCommand, 1)
	go readMutexCommands(commands)
	parent := uintptr(0)
	if *parentPID != os.Getpid() {
		parentHandle, openErr := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(*parentPID))
		if openErr == nil {
			parent = uintptr(parentHandle)
			defer windows.CloseHandle(parentHandle)
		}
	}

	for {
		if parent != 0 {
			parentWait, _, _ := waitForSingleObject.Call(parent, 0)
			if uint32(parentWait) == waitObject0 {
				fmt.Fprintf(os.Stdout, "PARENT_GONE %s\n", *operationID)
				return nil
			}
		}
		select {
		case command := <-commands:
			switch {
			case command.kind == "DONE" && command.token == token:
				releaseOwnedMutex(handle)
				fmt.Fprintf(os.Stdout, "RELEASED %s\n", *operationID)
				return nil
			case command.kind == "ABORT" && command.token == token:
				releaseOwnedMutex(handle)
				fmt.Fprintf(os.Stdout, "ABORTED %s\n", *operationID)
				return nil
			case command.kind == "EOF":
				// Keep ownership until the client process dies. A closed pipe is
				// not proof that a delegated writer has stopped.
				fmt.Fprintf(os.Stdout, "EOF_WAITING_FOR_CLIENT %s\n", *operationID)
			default:
				fmt.Fprintf(os.Stdout, "PROTOCOL_ERROR %s\n", *operationID)
			}
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func createRestrictedMutex(name string) (uintptr, uintptr, error) {
	sddl := "D:(A;;0x00120001;;;LS)(A;;0x00120001;;;SY)(A;;0x00120001;;;BA)"
	sddlPtr, _ := syscall.UTF16PtrFromString(sddl)
	var descriptor uintptr
	if result, _, err := convertStringSecurityDescriptor.Call(uintptr(unsafe.Pointer(sddlPtr)), 1, uintptr(unsafe.Pointer(&descriptor)), 0); result == 0 {
		return 0, 0, fmt.Errorf("security descriptor: %w", err)
	}
	namePtr, _ := syscall.UTF16PtrFromString(name)
	attributes := mutexSecurityAttributes{length: uint32(unsafe.Sizeof(mutexSecurityAttributes{})), securityDescriptor: descriptor}
	handle, _, err := createMutexEx.Call(uintptr(unsafe.Pointer(&attributes)), uintptr(unsafe.Pointer(namePtr)), 0, mutexModifyState|readControl|synchronize)
	if handle == 0 {
		localFree.Call(descriptor)
		return 0, 0, err
	}
	return handle, descriptor, nil
}

func releaseOwnedMutex(handle uintptr) {
	_, _, _ = releaseMutex.Call(handle)
}

func closeMutex(handle, descriptor uintptr) {
	closeHandle.Call(handle)
	localFree.Call(descriptor)
}

func readMutexCommands(commands chan<- mutexCommand) {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 256), 1024)
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) != 2 || len(parts[0]) > 16 || len(parts[1]) > 128 {
			commands <- mutexCommand{kind: "INVALID"}
			continue
		}
		commands <- mutexCommand{kind: strings.ToUpper(parts[0]), token: parts[1]}
	}
	commands <- mutexCommand{kind: "EOF"}
}
