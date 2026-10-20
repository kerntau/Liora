package enrich

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"

	"liora/db"
)

// Close stops the workers; a closed engine must stop accepting jobs too,
// otherwise every late trigger is buffered until the queue is full and then
// logged as "queue full" forever with no worker left to drain it.
func TestClosedEngineDoesNotBufferJobs(t *testing.T) {
	e := &Engine{jobs: make(chan job, 8), closed: make(chan struct{})}
	e.Close()
	e.ResolveDomain(1, "example.com")
	e.ProbeSite(2, "https://example.com")
	if n := len(e.jobs); n != 0 {
		t.Fatalf("closed engine buffered %d jobs that no worker will run", n)
	}
}

// A target page controls <title>. The probe body is capped at 1 MiB, so an
// unbounded title would be stored in page_title and returned by every asset
// list response.
func TestExtractTitleIsBounded(t *testing.T) {
	title := extractTitle([]byte("<html><head><title>" + strings.Repeat("长", 10000) + "</title></head></html>"))
	if n := utf8.RuneCountInString(title); n > maxTitleLen {
		t.Fatalf("title kept %d runes", n)
	}
	if !utf8.ValidString(title) || !strings.HasPrefix(title, "长长") {
		t.Fatalf("title broken: %q", title)
	}
	if got := extractTitle([]byte("<title>Probe &amp; Test</title>")); got != "Probe & Test" {
		t.Fatalf("title = %q", got)
	}
}

// The HTTP probe must record status and title for the service asset it owns.
func TestHTTPProbeRecordsServiceAsset(t *testing.T) {
	d, err := db.Open(filepath.Join(t.TempDir(), "enrich.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer d.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, "<html><head><title>Probe &amp; Test</title></head><body>ok</body></html>")
	}))
	defer srv.Close()
	e := New(d.Assets(), nil, 1)
	defer e.Close()
	e.doHTTP(42, srv.URL)
	assets, err := d.Assets().QueryByType("service", 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(assets) != 1 {
		t.Fatalf("service assets = %d", len(assets))
	}
	a := assets[0]
	if a.StatusCode == nil || *a.StatusCode != 200 || a.PageTitle != "Probe & Test" {
		t.Fatalf("probe recorded status=%v title=%q", a.StatusCode, a.PageTitle)
	}
	if a.ContentLength == nil || *a.ContentLength <= 0 {
		t.Fatalf("content length = %v", a.ContentLength)
	}
}
