package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

var archiveTables = map[string]bool{
	"explorations": true, "tasks": true, "assets": true, "exploration_nodes": true,
	"exploration_edges": true, "exploration_anchors": true, "task_constraints": true,
	"activity": true, "task_asset_links": true, "findings": true, "llm_records": true,
	"llm_usage": true, "skill_usage": true, "tool_usage": true, "side_question_sessions": true,
	"side_question_requests": true, "task_scope": true, "intercept_pending": true,
	"finding_traffic_bindings": true,
}

func archiveColumnTypes(tx *sql.Tx, table string) (map[string]string, error) {
	if !archiveTables[table] {
		return nil, fmt.Errorf("archive table %q is not allowed", table)
	}
	rows, err := tx.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var cid, nn, pk int
		var name, typ string
		var def any
		if err := rows.Scan(&cid, &name, &typ, &nn, &def, &pk); err != nil {
			return nil, err
		}
		out[name] = strings.ToUpper(typ)
	}
	return out, rows.Err()
}

func archiveValue(value any, typ string) (any, error) {
	if value == nil {
		return nil, nil
	}
	if typ == "JSON" {
		b, err := json.Marshal(value)
		return string(b), err
	}
	if n, ok := value.(json.Number); ok {
		if i, err := n.Int64(); err == nil {
			return i, nil
		}
		return n.Float64()
	}
	if typ == "DATETIME" {
		if s, ok := value.(string); ok {
			if t, ok := parseSQLiteTime(s); ok {
				return t, nil
			}
			return nil, fmt.Errorf("invalid archived timestamp %q", s)
		}
	}
	return value, nil
}

func insertArchiveObject(tx *sql.Tx, table string, row map[string]any, ignoreConflict bool) (sql.Result, error) {
	types, err := archiveColumnTypes(tx, table)
	if err != nil {
		return nil, err
	}
	columns := []string{}
	for col := range row {
		if _, exists := types[col]; exists {
			columns = append(columns, col)
		}
	}
	sort.Strings(columns)
	if len(columns) == 0 {
		return nil, fmt.Errorf("empty archive row for %s", table)
	}
	quoted := make([]string, len(columns))
	marks := make([]string, len(columns))
	args := make([]any, len(columns))
	for i, col := range columns {
		quoted[i] = "\"" + col + "\""
		marks[i] = "$" + strconv.Itoa(i+1)
		args[i], err = archiveValue(row[col], types[col])
		if err != nil {
			return nil, fmt.Errorf("%s.%s: %w", table, col, err)
		}
	}
	query := "INSERT INTO " + table + "(" + strings.Join(quoted, ",") + ") VALUES(" + strings.Join(marks, ",") + ")"
	if ignoreConflict {
		query += " ON CONFLICT DO NOTHING"
	}
	return tx.Exec(query, args...)
}

func insertArchiveObjects(tx *sql.Tx, table string, raw json.RawMessage, ignoreConflict bool) error {
	rows, err := decodeArchiveRows(raw)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if _, err := insertArchiveObject(tx, table, row, ignoreConflict); err != nil {
			return err
		}
	}
	return nil
}

func updateArchiveStub(tx *sql.Tx, table string, id int64, row map[string]any, fields []string) error {
	types, err := archiveColumnTypes(tx, table)
	if err != nil {
		return err
	}
	sets := []string{}
	args := []any{id}
	for _, col := range fields {
		value, exists := row[col]
		if !exists {
			continue
		}
		typ, ok := types[col]
		if !ok {
			return fmt.Errorf("unknown archive column %s.%s", table, col)
		}
		value, err = archiveValue(value, typ)
		if err != nil {
			return err
		}
		args = append(args, value)
		sets = append(sets, "\""+col+"\"=$"+strconv.Itoa(len(args)))
	}
	if len(sets) == 0 {
		return fmt.Errorf("empty archive update for %s", table)
	}
	_, err = tx.Exec("UPDATE "+table+" SET "+strings.Join(sets, ",")+" WHERE id=$1", args...)
	return err
}
