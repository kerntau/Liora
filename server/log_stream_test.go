package server

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLogStreamFrameCarriesEventID(t *testing.T) {
	var buf bytes.Buffer
	writeLogFrame(&buf, LogLine{Seq: 42, Level: "info", Text: "hello"})
	out := buf.String()
	if !strings.HasPrefix(out, "id: 42\n") {
		t.Fatalf("frame=%q, want id: line", out)
	}
	if !strings.Contains(out, "data: {") || !strings.HasSuffix(out, "\n\n") {
		t.Fatalf("frame=%q, want data + blank line", out)
	}
}

func TestLogStreamCursorPrefersLastEventID(t *testing.T) {
	for _, tc := range []struct {
		query, last string
		want        int64
	}{
		{"?since=5", "", 5},
		{"", "9", 9},
		{"?since=5", "9", 9},
		{"?since=12", "9", 12},
		{"?since=bogus", "7", 7},
		{"?since=-3", "", 0},
	} {
		r := httptest.NewRequest("GET", "/api/logs/stream"+tc.query, nil)
		if tc.last != "" {
			r.Header.Set("Last-Event-ID", tc.last)
		}
		if got := logStreamCursor(r); got != tc.want {
			t.Fatalf("query=%q last=%q: got %d, want %d", tc.query, tc.last, got, tc.want)
		}
	}
}
