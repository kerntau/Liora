package db

import (
	"database/sql"
	"fmt"
	"time"
)

// SQLite aggregates lose the declared DATETIME column type. Accept their UTC
// textual result while retaining database/sql's usual nullable-time behavior.
type sqliteNullTime struct{ sql.NullTime }

func (n *sqliteNullTime) Scan(value any) error {
	if b, ok := value.([]byte); ok {
		value = string(b)
	}
	if s, ok := value.(string); ok {
		for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999", "2006-01-02 15:04:05.999999999Z07:00"} {
			if t, err := time.Parse(layout, s); err == nil {
				n.Time = t
				n.Valid = true
				return nil
			}
		}
		return fmt.Errorf("invalid SQLite timestamp %q", s)
	}
	return n.NullTime.Scan(value)
}
