package server

import (
	"strings"
	"testing"
)

// The dashboard summary call (no page/limit) used to drop the DB error and answer
// 200 with [], which renders as "no findings" exactly when the database is down.
func TestFindingsEndpointReportsDBFailure(t *testing.T) {
	s, _, request := reportFixture(t)
	if err := s.m.pg.Close(); err != nil {
		t.Fatal(err)
	}
	w := request("/api/exploration/findings")
	if w.Code != 500 {
		t.Fatalf("status=%d body=%s, want 500", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "读取发现失败") {
		t.Fatalf("body=%s, want explicit read failure", w.Body.String())
	}
}
