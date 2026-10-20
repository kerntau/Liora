package server

import (
	"os"
	"path/filepath"
	"testing"

	pgdb "liora/db"
)

// A restore that installed files and then failed must keep its journal: that file
// is the only record of which paths were moved, and the startup recovery pass
// replays it. The extraction directory used to be deleted on every exit, so the
// installed files stayed in the data tree with nothing left to move them back and
// every later attempt failed on "restore destination already exists".
func TestFailedRestoreKeepsJournalSoRecoveryCanUndoIt(t *testing.T) {
	dataDir := t.TempDir()
	extracted := filepath.Join(taskArchiveRoot(dataDir), ".restore", "31-test")
	source := filepath.Join(extracted, "files", "tasks", "42", "evidence.txt")
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("evidence"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := installTaskArchiveFiles(dataDir, extracted, "42", 31); err != nil {
		t.Fatal(err)
	}
	destination := filepath.Join(dataDir, "tasks", "42", "evidence.txt")
	if _, err := os.Stat(destination); err != nil {
		t.Fatalf("install did not move the file: %v", err)
	}
	// The database restore failed after the files were installed, so the deferred
	// cleanup runs while the journal is still on disk.
	if err := cleanupRestoreExtraction(extracted); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(extracted, "restore-journal.json")); err != nil {
		t.Fatalf("restore journal was deleted; the installed files can never be rolled back: %v", err)
	}
	pg, err := pgdb.Open(filepath.Join(t.TempDir(), "recovery.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer pg.Close()
	if err := recoverTaskArchiveRestoreStages(dataDir, pg); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(destination); !os.IsNotExist(err) {
		t.Fatalf("recovery left the partial install in place: %v", err)
	}
	if _, err := os.Stat(extracted); !os.IsNotExist(err) {
		t.Fatalf("recovered staging directory remains: %v", err)
	}
	// The retry now re-extracts the package and installs into a clean destination;
	// before the journal was preserved this failed with "restore destination
	// already exists" forever.
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("evidence"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := installTaskArchiveFiles(dataDir, extracted, "42", 31); err != nil {
		t.Fatalf("retry after recovery is wedged: %v", err)
	}
}

// A clean rollback leaves nothing installed, so the extraction directory can still
// be dropped immediately instead of waiting for the next startup pass.
func TestCleanRestoreRollbackReleasesExtractionDirectory(t *testing.T) {
	dataDir := t.TempDir()
	extracted := filepath.Join(taskArchiveRoot(dataDir), ".restore", "32-test")
	source := filepath.Join(extracted, "files", "tasks", "42", "evidence.txt")
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("evidence"), 0o600); err != nil {
		t.Fatal(err)
	}
	stage, err := installTaskArchiveFiles(dataDir, extracted, "42", 32)
	if err != nil {
		t.Fatal(err)
	}
	if err := stage.rollback(); err != nil {
		t.Fatal(err)
	}
	if err := cleanupRestoreExtraction(extracted); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(extracted); !os.IsNotExist(err) {
		t.Fatalf("clean rollback left the extraction directory behind: %v", err)
	}
}
