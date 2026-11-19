package main

// 14.4b stage 2: durable file journal for the UPDATE executor. The journal lives
// outside every payload the update replaces (ProgramData state, not a version
// root). Save writes a temporary file in the same directory, flushes it to disk
// and replaces the journal with MoveFileEx(REPLACE_EXISTING|WRITE_THROUGH), so a
// crash leaves either the previous or the new complete record. Lock uses
// LockFileEx on a dedicated lock file; the operating system releases it when the
// holding process exits, including after a crash.

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

const (
	installTransitionJournalFile = "update-journal.json"
	installTransitionLockFile    = "update-journal.lock"
)

type fileInstallTransitionJournalStore struct {
	dir string
	// beforeReplace is a test seam called after the temporary file is durable and
	// before it replaces the journal. Production leaves it nil.
	beforeReplace func() error
}

func newFileInstallTransitionJournalStore(dir string) (*fileInstallTransitionJournalStore, error) {
	dir = filepath.Clean(dir)
	if !filepath.IsAbs(dir) || dir == "." {
		return nil, errors.New("journal_dir_not_absolute")
	}
	return &fileInstallTransitionJournalStore{dir: dir}, nil
}

func (s *fileInstallTransitionJournalStore) journalPath() string {
	return filepath.Join(s.dir, installTransitionJournalFile)
}

func (s *fileInstallTransitionJournalStore) Lock() (func() error, error) {
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return nil, fmt.Errorf("journal_dir: %w", err)
	}
	file, err := os.OpenFile(filepath.Join(s.dir, installTransitionLockFile), os.O_RDWR|os.O_CREATE, 0o600)
	if err != nil {
		return nil, fmt.Errorf("journal_lock_open: %w", err)
	}
	handle := windows.Handle(file.Fd())
	overlapped := new(windows.Overlapped)
	if err := windows.LockFileEx(handle, windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, overlapped); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("journal_lock_held: %w", err)
	}
	released := false
	return func() error {
		if released {
			return nil
		}
		released = true
		unlockErr := windows.UnlockFileEx(handle, 0, 1, 0, overlapped)
		closeErr := file.Close()
		if unlockErr != nil {
			return unlockErr
		}
		return closeErr
	}, nil
}

func (s *fileInstallTransitionJournalStore) Load() (installTransitionJournal, bool, error) {
	data, err := os.ReadFile(s.journalPath())
	if errors.Is(err, os.ErrNotExist) {
		return installTransitionJournal{}, false, nil
	}
	if err != nil {
		return installTransitionJournal{}, false, fmt.Errorf("journal_read: %w", err)
	}
	var journal installTransitionJournal
	if err := json.Unmarshal(data, &journal); err != nil {
		return installTransitionJournal{}, false, fmt.Errorf("journal_corrupt: %w", err)
	}
	if journal.Schema != installTransitionJournalSchema || journal.ApprovalID == "" || journal.State == "" {
		return installTransitionJournal{}, false, errors.New("journal_schema_invalid")
	}
	return journal, true, nil
}

func (s *fileInstallTransitionJournalStore) Save(journal installTransitionJournal) error {
	if journal.Schema != installTransitionJournalSchema || journal.ApprovalID == "" || journal.State == "" {
		return errors.New("journal_schema_invalid")
	}
	data, err := json.MarshalIndent(journal, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return err
	}
	temporary := s.journalPath() + ".tmp"
	file, err := os.OpenFile(temporary, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return fmt.Errorf("journal_temp_open: %w", err)
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		return fmt.Errorf("journal_temp_write: %w", err)
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return fmt.Errorf("journal_temp_flush: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("journal_temp_close: %w", err)
	}
	if s.beforeReplace != nil {
		if err := s.beforeReplace(); err != nil {
			return err
		}
	}
	from, err := windows.UTF16PtrFromString(temporary)
	if err != nil {
		return err
	}
	to, err := windows.UTF16PtrFromString(s.journalPath())
	if err != nil {
		return err
	}
	if err := windows.MoveFileEx(from, to, windows.MOVEFILE_REPLACE_EXISTING|windows.MOVEFILE_WRITE_THROUGH); err != nil {
		return fmt.Errorf("journal_replace: %w", err)
	}
	return nil
}
