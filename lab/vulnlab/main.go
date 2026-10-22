// Command vulnlab is a deliberately vulnerable, self-contained web target for
// authorized local testing. It exists so the Liora framework can be validated
// against SQL injection and XSS without a third-party vulnerable app or Docker.
//
// SAFETY: binds to 127.0.0.1 by default, uses a local SQLite file, and the
// injectable SELECT endpoints run on a read-only connection. Never expose it.
package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"html"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

const banner = "LOCAL AUTHORIZED LAB · 仅限 127.0.0.1 · 故意包含 SQLi / XSS · 禁止对外暴露"

type lab struct {
	rw *sql.DB
	ro *sql.DB
}

func main() {
	addr := flag.String("addr", "127.0.0.1:8081", "listen address (keep it loopback)")
	dbPath := flag.String("db", filepath.Join("lab", "vulnlab", "lab.db"), "SQLite database path")
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*dbPath), 0o755); err != nil {
		log.Fatalf("mkdir db dir: %v", err)
	}
	abs, err := filepath.Abs(*dbPath)
	if err != nil {
		log.Fatalf("abs db path: %v", err)
	}
	rw, err := sql.Open("sqlite", "file:"+filepath.ToSlash(abs)+"?_pragma=busy_timeout(5000)")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	rw.SetMaxOpenConns(1)
	defer rw.Close()
	if err := initSchema(rw); err != nil {
		log.Fatalf("init schema: %v", err)
	}
	if err := seed(rw, false); err != nil {
		log.Fatalf("seed: %v", err)
	}

	ro, err := sql.Open("sqlite", "file:"+filepath.ToSlash(abs)+"?mode=ro&_pragma=query_only(1)")
	if err != nil {
		log.Fatalf("open read-only db: %v", err)
	}
	defer ro.Close()

	l := &lab{rw: rw, ro: ro}
	mux := http.NewServeMux()
	mux.HandleFunc("/", l.index)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("/login", l.login)
	mux.HandleFunc("/dashboard", l.dashboard)
	mux.HandleFunc("/logout", l.logout)
	mux.HandleFunc("/search", l.search)
	mux.HandleFunc("/guestbook", l.guestbook)
	mux.HandleFunc("/api/users", l.apiUsers)
	mux.HandleFunc("/api/comments", l.apiComments)
	mux.HandleFunc("/lab/reset", l.reset)

	log.Printf("%s", banner)
	log.Printf("listening on http://%s  db=%s", *addr, abs)
	if err := http.ListenAndServe(*addr, logRequests(mux)); err != nil {
		log.Fatal(err)
	}
}

func initSchema(db *sql.DB) error {
	stmts := []string{
		"CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, email TEXT NOT NULL)",
		"CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)",
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func seed(db *sql.DB, force bool) error {
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n); err != nil {
		return err
	}
	if n > 0 && !force {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if force {
		if _, err := tx.Exec("DELETE FROM comments"); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM users"); err != nil {
			return err
		}
	}
	users := [][4]string{
		{"admin", "S3cr3t!Lab", "admin", "admin@lab.local"},
		{"alice", "alice123", "user", "alice@lab.local"},
		{"bob", "bob123", "user", "bob@lab.local"},
		{"flagholder", "flagholder123", "user", "flag@lab.local"},
	}
	for i, u := range users {
		if _, err := tx.Exec("INSERT INTO users(id, username, password, role, email) VALUES(?,?,?,?,?)", i+1, u[0], u[1], u[2], u[3]); err != nil {
			return err
		}
	}
	if n == 0 || force {
		now := time.Now().Format("2006-01-02 15:04:05")
		comments := [][2]string{
			{"alice", "这个靶场是本地授权测试用的。"},
			{"bob", "搜索框好像会把输入原样显示出来。"},
		}
		for _, c := range comments {
			if _, err := tx.Exec("INSERT INTO comments(author, body, created_at) VALUES(?,?,?)", c[0], c[1], now); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

func (l *lab) index(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	body := pageHead("VulnLab") + bannerBox() + `
<h1>VulnLab · 本地自建靶场</h1>
<p>这是为 Liora 验证 SQL 注入与 XSS 而写的本地目标，不依赖第三方靶场或 Docker。</p>
<ul>
  <li><a href="/login">登录（SQL 注入点 1）</a></li>
  <li><a href="/search?q=hello">搜索（反射型 XSS）</a></li>
  <li><a href="/guestbook">留言板（存储型 XSS）</a></li>
  <li><a href="/api/users?id=1">/api/users?id=1</a>（SQL 注入点 2，JSON）</li>
  <li><a href="/healthz">/healthz</a></li>
</ul>
<p class="hint">重置数据：<code>curl -X POST "http://127.0.0.1:8081/lab/reset?confirm=1"</code></p>
` + pageFoot
	writeHTML(w, 200, body)
}

func (l *lab) login(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		writeHTML(w, 200, pageHead("登录")+loginPage("")+pageFoot)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", 405)
		return
	}
	_ = r.ParseForm()
	username := r.FormValue("username")
	password := r.FormValue("password")

	// INTENTIONALLY VULNERABLE: string concatenation, no parameterization.
	q := fmt.Sprintf("SELECT id, username, role FROM users WHERE username = '%s' AND password = '%s'", username, password)
	rows, err := l.ro.Query(q)
	if err != nil {
		writeHTML(w, 500, pageHead("登录失败")+loginPage("SQL error: "+err.Error())+pageFoot)
		return
	}
	defer rows.Close()
	if !rows.Next() {
		writeHTML(w, 401, pageHead("登录失败")+loginPage("用户名或密码错误")+pageFoot)
		return
	}
	var id int
	var name, role string
	if err := rows.Scan(&id, &name, &role); err != nil {
		writeHTML(w, 500, pageHead("登录失败")+loginPage("scan error: "+err.Error())+pageFoot)
		return
	}
	setCookie(w, "lab_uid", strconv.Itoa(id))
	setCookie(w, "lab_name", name)
	setCookie(w, "lab_role", role)
	http.Redirect(w, r, "/dashboard", http.StatusSeeOther)
}

func (l *lab) dashboard(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Cookie("lab_uid")
	name, _ := r.Cookie("lab_name")
	role, _ := r.Cookie("lab_role")
	if uid == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}
	displayName := ""
	displayRole := ""
	if name != nil {
		displayName = name.Value
	}
	if role != nil {
		displayRole = role.Value
	}
	var dbName, dbRole string
	if err := l.rw.QueryRow("SELECT username, role FROM users WHERE id = ?", uid.Value).Scan(&dbName, &dbRole); err == nil {
		displayName, displayRole = dbName, dbRole
	}
	flag := ""
	if displayRole == "admin" {
		flag = `<div class="flag">FLAG{sqli_login_bypass_admin}</div>`
	}
	body := pageHead("控制台") + bannerBox() + fmt.Sprintf(`
<h1>控制台</h1>
<p>当前用户：<b>%s</b>（role=%s）</p>
%s
<p><a href="/search?q=hello">搜索</a> · <a href="/guestbook">留言板</a> · <a href="/logout">退出</a></p>
`, html.EscapeString(displayName), html.EscapeString(displayRole), flag) + pageFoot
	writeHTML(w, 200, body)
}

func (l *lab) logout(w http.ResponseWriter, r *http.Request) {
	for _, k := range []string{"lab_uid", "lab_name", "lab_role"} {
		http.SetCookie(w, &http.Cookie{Name: k, Value: "", Path: "/", MaxAge: -1})
	}
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (l *lab) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	body := pageHead("搜索") + bannerBox() + fmt.Sprintf(`
<h1>搜索</h1>
<form method="get" action="/search">
  <input name="q" value="%s" size="50" placeholder="输入关键词">
  <button type="submit">搜索</button>
</form>
<p>你搜索的是：<span id="q">%s</span></p>
<div class="results">
  <div class="item">示例结果 1</div>
  <div class="item">示例结果 2</div>
</div>
`, html.EscapeString(q), q) + pageFoot
	writeHTML(w, 200, body)
}

func (l *lab) guestbook(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		_ = r.ParseForm()
		author := strings.TrimSpace(r.FormValue("author"))
		body := r.FormValue("body")
		if author == "" {
			author = "anonymous"
		}
		if _, err := l.rw.Exec("INSERT INTO comments(author, body, created_at) VALUES(?,?,?)", author, body, time.Now().Format("2006-01-02 15:04:05")); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		http.Redirect(w, r, "/guestbook", http.StatusSeeOther)
		return
	}
	rows, err := l.rw.Query("SELECT author, body, created_at FROM comments ORDER BY id DESC")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()
	var b strings.Builder
	b.WriteString(pageHead("留言板"))
	b.WriteString(bannerBox())
	b.WriteString(`<h1>留言板</h1>
<form method="post" action="/guestbook">
  <input name="author" placeholder="昵称" value="visitor">
  <textarea name="body" rows="3" cols="60" placeholder="留言内容"></textarea>
  <button type="submit">提交</button>
</form><hr>`)
	for rows.Next() {
		var author, body, created string
		if err := rows.Scan(&author, &body, &created); err != nil {
			continue
		}
		// INTENTIONALLY VULNERABLE: stored and rendered without escaping.
		b.WriteString(fmt.Sprintf(`<div class="comment"><b>%s</b> <time>%s</time><p>%s</p></div>`, author, created, body))
	}
	b.WriteString(pageFoot)
	writeHTML(w, 200, b.String())
}

func (l *lab) apiUsers(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		id = "1"
	}
	// INTENTIONALLY VULNERABLE: raw concatenation on a read-only connection.
	q := "SELECT id, username, role, email FROM users WHERE id = " + id
	rows, err := l.ro.Query(q)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error(), "query": q})
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var uid int
		var username, role, email string
		if err := rows.Scan(&uid, &username, &role, &email); err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
		out = append(out, map[string]any{"id": uid, "username": username, "role": role, "email": email})
	}
	writeJSON(w, 200, map[string]any{"query": q, "count": len(out), "users": out})
}

func (l *lab) apiComments(w http.ResponseWriter, r *http.Request) {
	rows, err := l.rw.Query("SELECT id, author, body, created_at FROM comments ORDER BY id DESC")
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int
		var author, body, created string
		if err := rows.Scan(&id, &author, &body, &created); err != nil {
			continue
		}
		out = append(out, map[string]any{"id": id, "author": author, "body": body, "created_at": created})
	}
	writeJSON(w, 200, map[string]any{"count": len(out), "comments": out})
}

func (l *lab) reset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", 405)
		return
	}
	if r.URL.Query().Get("confirm") != "1" {
		http.Error(w, "add ?confirm=1", 400)
		return
	}
	if err := seed(l.rw, true); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, 200, map[string]any{"reset": true})
}

func pageHead(title string) string {
	return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>` + html.EscapeString(title) + ` · VulnLab</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:860px;margin:32px auto;padding:0 16px;color:#1f2937;line-height:1.6}
  .banner{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:8px 12px;border-radius:8px;font-size:13px;margin-bottom:20px}
  h1{font-size:24px;margin:0 0 12px}
  input,textarea{border:1px solid #cbd5e1;border-radius:6px;padding:8px;font:inherit}
  button{background:#111827;color:#fff;border:0;border-radius:6px;padding:9px 16px;cursor:pointer}
  .item,.comment{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:8px 0}
  .comment time{color:#6b7280;font-size:12px;margin-left:8px}
  .flag{background:#ecfdf5;border:1px solid #10b981;color:#065f46;padding:10px 12px;border-radius:8px;font-family:ui-monospace,monospace;margin:12px 0}
  .hint{color:#6b7280;font-size:13px}
  code{background:#f3f4f6;padding:2px 5px;border-radius:4px}
</style></head><body>`
}

func bannerBox() string {
	return `<div class="banner">` + banner + `</div>`
}

func loginPage(msg string) string {
	m := ""
	if msg != "" {
		m = `<p class="flag" style="background:#fef2f2;border-color:#ef4444;color:#991b1b">` + html.EscapeString(msg) + `</p>`
	}
	return bannerBox() + `
<h1>登录</h1>` + m + `
<form method="post" action="/login">
  <p><input name="username" placeholder="用户名" value="admin"></p>
  <p><input name="password" type="password" placeholder="密码" value=""></p>
  <p><button type="submit">登录</button></p>
</form>
<p class="hint">提示：这是故意保留 SQL 注入的登录点。默认账号 admin / S3cr3t!Lab。</p>`
}

const pageFoot = `</body></html>`

func writeHTML(w http.ResponseWriter, code int, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_, _ = w.Write([]byte(body))
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func setCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: false, SameSite: http.SameSiteLaxMode})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s %s", r.Method, r.URL.RequestURI(), r.RemoteAddr, time.Since(start).Round(time.Millisecond))
	})
}