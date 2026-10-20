package db

// schedulerGoalMetIndexSQL indexes the scheduler's incremental "which goals were
// met at/after the watermark" scan. schema.sql is applied only when a database is
// created (PRAGMA user_version 0), so an index added afterwards never reaches an
// existing database by replaying the schema; creating it on every open is
// additive, idempotent and rewrites no table data.
//
// Rollback: DROP INDEX IF EXISTS idx_expnodes_goal_met_wm (an old binary ignores
// the extra index).
const schedulerGoalMetIndexSQL = `CREATE INDEX IF NOT EXISTS idx_expnodes_goal_met_wm
ON exploration_nodes(updated_at) WHERE kind='goal' AND state='met'`

// EnsureSchedulerIndexes creates the scheduler's partial index (idempotent; a
// no-op once the index exists).
func (d *DB) EnsureSchedulerIndexes() error {
	_, err := d.Exec(schedulerGoalMetIndexSQL)
	return err
}
