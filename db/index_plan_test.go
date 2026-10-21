package db

import (
	"strings"
	"testing"
)

func explainQueryPlan(t *testing.T, d *DB, query string) string {
	t.Helper()
	rows, err := d.Query("EXPLAIN QUERY PLAN " + query)
	if err != nil {
		t.Fatalf("explain query plan: %v", err)
	}
	defer rows.Close()
	details := []string{}
	for rows.Next() {
		var id, parent, notUsed int
		var detail string
		if err := rows.Scan(&id, &parent, &notUsed, &detail); err != nil {
			t.Fatal(err)
		}
		details = append(details, detail)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return strings.Join(details, "\n")
}

// TestAggregationQueriesUseIndexes pins the access path of the two dashboard
// aggregations: without idx_act_kind_created / idx_llm_usage_ts they degrade to a
// full scan as the tables grow, and a dropped or misnamed index must fail loudly.
func TestAggregationQueriesUseIndexes(t *testing.T) {
	d, err := Open(testDSN(t))
	if err != nil {
		t.Fatalf("SQLite unavailable (%v) — skipping", err)
	}
	defer d.Close()
	if err := d.EnsureLLMUsageTable(); err != nil {
		t.Fatal(err)
	}

	activityPlan := explainQueryPlan(t, d, `
		SELECT strftime('%Y-%m-%d',created_at) AS day,
		       COALESCE(SUM(input_tokens), 0),
		       COALESCE(SUM(output_tokens), 0),
		       COALESCE(SUM(cache_read_tokens), 0)
		FROM activity
		WHERE kind = 'result'
		  AND created_at >= strftime('%Y-%m-%d %H:%M:%f','now','-30 days')
		GROUP BY day
		ORDER BY day`)
	t.Logf("TokenDailyAll plan:\n%s", activityPlan)
	if !strings.Contains(activityPlan, "idx_act_kind_created") {
		t.Fatalf("TokenDailyAll plan does not use idx_act_kind_created:\n%s", activityPlan)
	}

	usagePlan := explainQueryPlan(t, d, `
		SELECT COALESCE(profile_name,'') AS profile_name,
		       strftime('%Y-%m-%d',ts) AS day,
		       COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0), COALESCE(SUM(cache_read),0)
		FROM llm_usage
		WHERE ts >= datetime('now', printf('-%d days', 30))
		GROUP BY profile_name, day
		ORDER BY day`)
	t.Logf("UsageDaily plan:\n%s", usagePlan)
	if !strings.Contains(usagePlan, "idx_llm_usage_ts") {
		t.Fatalf("UsageDaily plan does not use idx_llm_usage_ts:\n%s", usagePlan)
	}
}

// TestEnsureQueryIndexesRecreatesOnOpen covers databases created before these
// indexes existed: schema.sql is never replayed, so only the per-open hook can add
// them. Dropping the index and reopening must restore it.
func TestEnsureQueryIndexesRecreatesOnOpen(t *testing.T) {
	path := testDSN(t)
	d, err := Open(path)
	if err != nil {
		t.Fatalf("SQLite unavailable (%v) — skipping", err)
	}
	if _, err := d.Exec("DROP INDEX IF EXISTS idx_act_kind_created"); err != nil {
		d.Close()
		t.Fatal(err)
	}
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}

	d, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	var count int
	if err := d.QueryRow(`SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_act_kind_created'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("idx_act_kind_created was not recreated on open (count=%d)", count)
	}
}
