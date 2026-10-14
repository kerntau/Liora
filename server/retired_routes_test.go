package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Retired routes must fail, rather than render a page or expose stale handlers.
func TestRetiredAPIRoutesReturnNotFound(t *testing.T) {
	s := &Server{jwtKey: []byte("cleanup-route-test-key")}
	token, err := signJWT(s.jwtKey)
	if err != nil {
		t.Fatal(err)
	}
	h := s.Handler()
	for _, route := range []struct{ method, path string }{
		{"GET", "/api/workspace/list"}, {"POST", "/api/workspace/write"},
		{"GET", "/api/sync/scopesentry/status"}, {"POST", "/api/sync/scopesentry/sync"},
		{"GET", "/api/update/check"}, {"POST", "/api/update/apply"},
		{"GET", "/api/commands"}, {"GET", "/api/commands/stats"},
		{"GET", "/api/llm/records"}, {"DELETE", "/api/llm/records"},
		{"GET", "/api/conversations"}, {"POST", "/api/conversations"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, nil)
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			if w.Code != http.StatusNotFound {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
		})
	}
}
