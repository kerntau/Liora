package server

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	pgdb "liora/db"
	"liora/traffic"
)

const (
	archiveLockExclusiveHost = "exclusive.lock-order"
	archiveLockKeptID        = "kept-1"
)

// archiveLockFixture builds the minimum a compaction needs: a task with a claimed
// archive job, its manifest snapshot, and two recorded exchanges — one on the host
// the archive takes exclusively, one that stays in the hot store.
func archiveLockFixture(t *testing.T) (pg *pgdb.DB, tr *traffic.Traffic, trafficDir string, job *pgdb.TaskArchive, snapshot *pgdb.TaskArchiveSnapshot) {
	t.Helper()
	dir := t.TempDir()
	pg, err := pgdb.Open(filepath.Join(dir, "business.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Close() })
	if err := pg.EnsureLLMRecordsTable(); err != nil {
		t.Fatal(err)
	}
	if err := pg.EnsureLLMUsageTable(); err != nil {
		t.Fatal(err)
	}
	task, err := pg.CreateTask("lock order "+t.Name(), "local fixtures", nil, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	trafficDir = filepath.Join(dir, "traffic")
	tr, err = traffic.Open(trafficDir, ":0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tr.Close() })
	for _, row := range []struct{ id, host string }{
		{"exclusive-1", archiveLockExclusiveHost},
		{archiveLockKeptID, "kept.lock-order"},
	} {
		if _, err := tr.DB().Exec(`INSERT INTO exchanges(id,ts,host,method,url_template,url,status,content_type,req_len,resp_len,path)
VALUES(?,?,?,'GET','/probe',?,200,'text/plain',2,2,'')`, row.id, time.Now().Unix(), row.host, "https://"+row.host+"/probe"); err != nil {
			t.Fatal(err)
		}
		if _, err := tr.DB().Exec(`INSERT INTO exchange_bodies(id,req_head,req_body,resp_head,resp_body) VALUES(?,?,?,?,?)`,
			row.id, "GET /probe HTTP/1.1\r\n\r\n", []byte("{}"), "HTTP/1.1 200 OK\r\n\r\n", []byte("{}")); err != nil {
			t.Fatal(err)
		}
	}
	if err := pg.SetPaused(task.ID, true); err != nil {
		t.Fatal(err)
	}
	if _, err := pg.QueueTaskArchive(task.ID); err != nil {
		t.Fatal(err)
	}
	job, err = pg.ClaimTaskArchiveJob(context.Background())
	if err != nil || job == nil || job.State != pgdb.Archiving {
		t.Fatalf("claim archive job: %+v, %v", job, err)
	}
	snapshot, err = pg.SnapshotTaskArchive(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	snapshot.ExclusiveHosts = []string{archiveLockExclusiveHost}
	return pg, tr, trafficDir, job, snapshot
}

// TestArchiveCompactionKeepsTheDatabaseBeforeTrafficLockOrder pins the lock order
// of the archive compaction against the evidence writer's.
//
// evidence.Store.Record opens WithEvidenceTx (BEGIN IMMEDIATE, the writer
// reservation) and only then calls Traffic.ReadEvidence, which takes the traffic
// write lock. The archive used to do the opposite: stage the exclusive-host
// traffic deletion first — holding the traffic write lock until Commit — and only
// then ask for the database reservation in CompleteTaskArchive. One evidence
// write landing in that window wedged both sides: the archive waited for the
// database, the evidence write waited for traffic, until busy_timeout expired and
// the archive failed with "database is locked".
//
// The test holds the writer reservation exactly where Record holds it, runs the
// real compaction, and requires the evidence read to finish while the reservation
// is still held. That is only possible when the compaction takes the database
// reservation before the traffic write lock.
func TestArchiveCompactionKeepsTheDatabaseBeforeTrafficLockOrder(t *testing.T) {
	pg, tr, trafficDir, job, snapshot := archiveLockFixture(t)
	ctx := context.Background()

	// The evidence writer's reservation: BEGIN IMMEDIATE is what WithEvidenceTx
	// takes, and the ReadEvidence below is the call prepare makes inside it.
	tx, err := pg.Begin()
	if err != nil {
		t.Fatal(err)
	}

	archiveDone := make(chan error, 1)
	go func() {
		stage, err := compactTaskArchive(pg, tr, job, snapshot, filepath.Join(os.TempDir(), "lockorder-pkg.tar.zst"), "sha", 1, 1)
		if err == nil {
			err = stage.Commit()
		}
		archiveDone <- err
	}()

	// Old order: the compaction takes the traffic write lock first, and the
	// staging directory proves it. New order: it never gets that far while the
	// reservation is held, so this is a bounded wait, not a synchronisation.
	waitForTrafficStage(t, filepath.Join(trafficDir, "_delete_staging"), time.Second)

	readDone := make(chan error, 1)
	go func() {
		readDone <- tr.ReadEvidence(ctx, []string{archiveLockKeptID}, func(traffic.EvidenceExchange) error {
			return nil
		})
	}()

	var readErr error
	readWedged := false
	select {
	case readErr = <-readDone:
	case <-time.After(5 * time.Second):
		readWedged = true
	}
	// Release the reservation so the compaction can finish and the failure is
	// reported without leaking a goroutine that holds the traffic write lock.
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit evidence reservation: %v", err)
	}
	var archiveErr error
	select {
	case archiveErr = <-archiveDone:
	case <-time.After(30 * time.Second):
		t.Fatal("archive compaction never finished")
	}
	if readWedged {
		select {
		case <-readDone:
		case <-time.After(30 * time.Second):
		}
		t.Fatalf("evidence read blocked on the traffic write lock while the archive waited for the database reservation (lock inversion); archive error: %v", archiveErr)
	}
	if readErr != nil {
		t.Fatalf("evidence read: %v", readErr)
	}
	if archiveErr != nil {
		t.Fatalf("archive compaction: %v", archiveErr)
	}
}

// waitForTrafficStage reports whether a traffic deletion was staged within the
// budget. It is a hint for test ordering only; the assertion above does not
// depend on it.
func waitForTrafficStage(t *testing.T, stagingDir string, budget time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(budget)
	for time.Now().Before(deadline) {
		if entries, err := os.ReadDir(stagingDir); err == nil && len(entries) > 0 {
			return true
		}
		time.Sleep(2 * time.Millisecond)
	}
	return false
}
