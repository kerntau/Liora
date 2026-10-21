package db

import (
	"path/filepath"
	"testing"
)

// seedKindStateNodes opens a throwaway DB whose single exploration holds n intent
// nodes spread evenly over the four live intent states. Benchmarks only: the plan
// test seeds through the public store API, this helper inserts the bulk rows in one
// transaction so the measured loop is the query, not the fixture.
func seedKindStateNodes(b *testing.B, n int) (*DB, *ExplorationStore) {
	b.Helper()
	d, err := Open(filepath.Join(b.TempDir(), "bench.db"))
	if err != nil {
		b.Fatalf("open db: %v", err)
	}
	b.Cleanup(func() { d.Close() })
	expID, err := d.CreateExploration("counts bench", "状态计数基准")
	if err != nil {
		b.Fatalf("create exploration: %v", err)
	}
	tx, err := d.Begin()
	if err != nil {
		b.Fatalf("begin: %v", err)
	}
	defer tx.Rollback() //nolint:errcheck
	stmt, err := tx.Prepare(`INSERT INTO exploration_nodes(exploration_id, kind, payload, state, priority, origin)
VALUES ($1,$2,$3,$4,0,'planner')`)
	if err != nil {
		b.Fatalf("prepare: %v", err)
	}
	states := []string{"open", "running", "paused", "done"}
	for i := 0; i < n; i++ {
		if _, err := stmt.Exec(expID, KindIntent, `{"summary":"bench"}`, states[i%len(states)]); err != nil {
			b.Fatalf("insert %d: %v", i, err)
		}
	}
	if err := stmt.Close(); err != nil {
		b.Fatalf("close stmt: %v", err)
	}
	if err := tx.Commit(); err != nil {
		b.Fatalf("commit: %v", err)
	}
	return d, d.Exploration(expID)
}

// BenchmarkKindStateCounts measures the node counters behind /api/stats. With
// idx_expnodes_kind_state the GROUP BY is answered from the index (no table
// lookup per row); without it every call reads the slice back from the table.
func BenchmarkKindStateCounts(b *testing.B) {
	_, store := seedKindStateNodes(b, 1000)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		counts, err := store.KindStateCounts(KindIntent)
		if err != nil {
			b.Fatal(err)
		}
		if len(counts) != 4 {
			b.Fatalf("KindStateCounts returned %d states, want 4", len(counts))
		}
	}
}
