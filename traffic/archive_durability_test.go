package traffic

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func writeArchiveFixture(t *testing.T, dir, id, host string, body []byte) string {
	t.Helper()
	sum := sha256.Sum256(body)
	hash := hex.EncodeToString(sum[:])
	if err := os.MkdirAll(filepath.Join(dir, "blobs"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "blobs", hash+".bin"), body, 0o600); err != nil {
		t.Fatal(err)
	}
	snapshot := ArchiveSnapshot{Version: 1, Blobs: []string{hash}, Exchanges: []ArchiveExchange{{
		ID: id, TS: 1, Host: host, Method: "GET", URLTemplate: "/", URL: "https://" + host + "/",
		Status: 200, ContentType: "text/plain", ReqHead: "GET / HTTP/1.1", ReqBody: []byte("q"),
		RespHead: "HTTP/1.1 200 OK", RespLen: len(body), RespBlob: hash,
	}}}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "traffic.json"), raw, 0o600); err != nil {
		t.Fatal(err)
	}
	return hash
}

// A blob that no longer matches its hash cannot be packaged: the package would be
// permanently unrestorable, while archiving still deletes the live rows - so the
// only copy of the evidence would end up in a file ImportArchive rejects forever.
func TestExportHostsRefusesBlobThatFailsItsHash(t *testing.T) {
	dir := t.TempDir()
	tr, err := Open(dir, "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer tr.Close()
	const (
		id   = "corrupt-blob-exchange"
		host = "corrupt-blob.example"
	)
	body := []byte("response body that must not be archived in a corrupt state")
	sum := sha256.Sum256(body)
	hash := hex.EncodeToString(sum[:])
	if _, err := tr.DB().Exec("INSERT INTO exchanges(id,ts,host,method,url_template,url,status,content_type,req_len,resp_len,path) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
		id, 1, host, "GET", "/", "https://"+host+"/", 200, "text/plain", 1, len(body), ""); err != nil {
		t.Fatal(err)
	}
	if _, err := tr.DB().Exec("INSERT INTO exchange_bodies(id,req_head,req_body,resp_head,resp_blob) VALUES(?,?,?,?,?)",
		id, "GET / HTTP/1.1", []byte("q"), "HTTP/1.1 200 OK", hash); err != nil {
		t.Fatal(err)
	}
	// Simulate a body truncated by a crash mid-write.
	blobDir := filepath.Join(dir, "_blobs", "sha256", hash[:2])
	if err := os.MkdirAll(blobDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(blobDir, hash+".bin"), body[:9], 0o644); err != nil {
		t.Fatal(err)
	}
	archiveDir := filepath.Join(t.TempDir(), "traffic")
	if _, err := tr.ExportHosts([]string{host}, archiveDir); err == nil {
		t.Fatal("ExportHosts packaged a blob that does not match its hash; the package can never be restored")
	}
}

// A previous import can be interrupted between creating the destination blob and
// finishing it. Trusting "the file exists" keeps that truncated body forever: the
// rows are inserted, blob_refs keeps the file alive, and every read serves
// truncated evidence with no way to repair it.
func TestImportArchiveReplacesTruncatedDestinationBlob(t *testing.T) {
	dir := t.TempDir()
	tr, err := Open(dir, "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer tr.Close()
	const (
		id   = "restore-corrupt-exchange"
		host = "restore-corrupt.example"
	)
	body := []byte("the complete archived response body")
	archiveDir := filepath.Join(t.TempDir(), "traffic")
	hash := writeArchiveFixture(t, archiveDir, id, host, body)
	destination := filepath.Join(dir, "_blobs", "sha256", hash[:2], hash+".bin")
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(destination, body[:6], 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := tr.ImportArchive(archiveDir); err != nil {
		t.Fatalf("import: %v", err)
	}
	f, _, err := tr.Blob(hash)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	got, err := io.ReadAll(f)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, body) {
		t.Fatalf("restored blob is corrupt: got %q want %q", got, body)
	}
}
