package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPADeepLinksAndMissingResources(t *testing.T) {
	h, err := newWebUIHandler(fstest.MapFS{
		"routes.json":   {Data: []byte(`{"home":"/","login":"/login","detail":"/function/tasks/detail"}`)},
		"index.html":    {Data: []byte("<!doctype html><title>Liora · 灵探</title>")},
		"static/app.js": {Data: []byte("console.log('liora')")},
		"api/stale":     {Data: []byte("must not be served")},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		method, url string
		status      int
		content     string
	}{
		{"GET", "/", 200, "Liora"},
		{"GET", "/login/", 200, "Liora"},
		{"GET", "/function/tasks/detail?id=42", 200, "Liora"},
		{"HEAD", "/function/tasks/detail/", 200, ""},
		{"GET", "/static/app.js", 200, "console.log"},
		{"GET", "/static/missing.js", 404, "404"},
		{"GET", "/api/stale", 404, "404"},
		{"GET", "/function/conversations", 404, "404"},
		{"GET", "/missing", 404, "404"},
		{"POST", "/login", 405, "method not allowed"},
	} {
		t.Run(tc.method+tc.url, func(t *testing.T) {
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest(tc.method, tc.url, nil))
			if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.content) {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if tc.method == http.MethodHead && w.Body.Len() != 0 {
				t.Fatal("HEAD returned a body")
			}
		})
	}
}

func TestSPAFailsWithoutBuildManifest(t *testing.T) {
	if _, err := newWebUIHandler(fstest.MapFS{}); err == nil {
		t.Fatal("missing manifest accepted")
	}
}
