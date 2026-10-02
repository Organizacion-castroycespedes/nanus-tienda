package main

import (
	"errors"
	"fmt"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Keep the existing identity/rights policy. Replace the entire DACL in one
// Windows API operation: disabling inheritance recursively before granting
// directory-only inheritable ACEs can otherwise leave files with zero ACEs.
var setManagedPathACL = applyManagedPathACL

func applyManagedPathACL(path, permission string, broadRead bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return errors.New("managed ACL path is a reparse point")
	}
	rights := ""
	switch permission {
	case "RX":
		rights = "0x1200a9"
	case "M":
		rights = "0x1301bf"
	default:
		return errors.New("unsupported managed ACL permission")
	}
	flags := ""
	if info.IsDir() {
		flags = "OICI"
	}
	sddl := fmt.Sprintf("D:P(A;%s;FA;;;SY)(A;%s;FA;;;BA)(A;%s;%s;;;LS)", flags, flags, flags, rights)
	if broadRead {
		sddl += fmt.Sprintf("(A;%s;0x1200a9;;;AU)", flags)
	}
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return err
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		return err
	}
	if dacl == nil || dacl.AceCount < 3 {
		return errors.New("invalid managed ACL policy")
	}
	if err := windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT,
		windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION,
		nil, nil, dacl, nil); err != nil {
		return err
	}
	return verifyManagedPathACL(path, permission, broadRead)
}

// Verify the concrete descriptor, not a localized command's success message.
// Exact allow-only identities/masks also reject null/empty DACLs, unexpected
// writers, inherited legacy denies and directory-only ACEs on executables.
func verifyManagedPathACL(path, permission string, broadRead bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	expected := map[string]windows.ACCESS_MASK{"S-1-5-18": 0x1f01ff, "S-1-5-32-544": 0x1f01ff}
	switch permission {
	case "RX":
		expected["S-1-5-19"] = 0x1200a9
	case "M":
		expected["S-1-5-19"] = 0x1301bf
	default:
		return errors.New("unsupported managed ACL permission")
	}
	if broadRead {
		expected["S-1-5-11"] = 0x1200a9
	}
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		return err
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		return err
	}
	if dacl == nil || int(dacl.AceCount) != len(expected) {
		return errors.New("managed DACL is missing, empty or has unexpected ACEs")
	}
	flags := uint8(0)
	if info.IsDir() {
		flags = 3
	} // OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE
	for i := uint16(0); i < dacl.AceCount; i++ {
		var ace *windows.ACCESS_ALLOWED_ACE
		if err := windows.GetAce(dacl, uint32(i), &ace); err != nil {
			return err
		}
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart)).String()
		mask, known := expected[sid]
		if !known || ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceFlags != flags || ace.Mask != mask {
			return errors.New("managed DACL violates identity/rights policy")
		}
		delete(expected, sid)
	}
	if len(expected) != 0 {
		return errors.New("managed DACL omits required identity")
	}
	return nil
}

func uninstallStopResult(err error) error {
	if err == nil || errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) || errors.Is(err, windows.ERROR_SERVICE_NOT_ACTIVE) {
		return nil
	}
	return fmt.Errorf("uninstall stop service: %w", err)
}
