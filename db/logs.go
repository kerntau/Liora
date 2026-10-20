package db

import (
	"context"
	"time"
)

// DBLog is one persisted backend log row from the server_logs table.
type DBLog struct {
	ID        int64
	CreatedAt time.Time
	Level     string
	Tag       string
	Text      string
}

// InsertLog appends one log line and returns its auto-assigned id.
func (d *DB) InsertLog(level, tag, text string) (int64, error) {
	var id int64
	err := d.QueryRowContext(context.Background(),
		"INSERT INTO server_logs(level,tag,text) VALUES($1,$2,$3) RETURNING id",
		level, tag, text,
	).Scan(&id)
	return id, err
}

// scanLogs materializes server_logs rows. Both log queries share it so a driver
// error that ends iteration is reported instead of returning a page that looks
// complete while its tail was silently dropped.
func scanLogs(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]*DBLog, error) {
	var out []*DBLog
	for rows.Next() {
		l := &DBLog{}
		if err := rows.Scan(&l.ID, &l.CreatedAt, &l.Level, &l.Tag, &l.Text); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// RecentLogs returns the most recent limit rows, oldest-first. It is the
// background-context convenience wrapper; request handlers should call
// RecentLogsContext with the request context.
func (d *DB) RecentLogs(limit int) ([]*DBLog, error) {
	return d.RecentLogsContext(context.Background(), limit)
}

// RecentLogsContext is RecentLogs bound to ctx, so an aborted client cancels the
// read instead of keeping the query alive after the request is gone.
func (d *DB) RecentLogsContext(ctx context.Context, limit int) ([]*DBLog, error) {
	rows, err := d.QueryContext(ctx,
		`SELECT id, created_at, level, tag, text
		   FROM server_logs
		  ORDER BY id DESC
		  LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := scanLogs(rows)
	if err != nil {
		return nil, err
	}
	// Reverse to oldest-first
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}

// ListLogsBefore returns up to limit rows with id < beforeID, oldest-first. It is
// the background-context convenience wrapper; request handlers should call
// ListLogsBeforeContext with the request context.
func (d *DB) ListLogsBefore(beforeID int64, limit int) ([]*DBLog, error) {
	return d.ListLogsBeforeContext(context.Background(), beforeID, limit)
}

// ListLogsBeforeContext is ListLogsBefore bound to ctx.
func (d *DB) ListLogsBeforeContext(ctx context.Context, beforeID int64, limit int) ([]*DBLog, error) {
	rows, err := d.QueryContext(ctx,
		`SELECT id, created_at, level, tag, text
		   FROM server_logs
		  WHERE id < $1
		  ORDER BY id DESC
		  LIMIT $2`, beforeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := scanLogs(rows)
	if err != nil {
		return nil, err
	}
	// Reverse to oldest-first
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}
