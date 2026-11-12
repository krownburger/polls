const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const ROOT = __dirname;
const SITE_PASSWORD = process.env.SITE_PASSWORD || "";
const AUTH_HASH = SITE_PASSWORD ? crypto.createHash("sha256").update(SITE_PASSWORD).digest("hex") : "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return { polls: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function isValidPoll(p) {
  return (
    p &&
    typeof p.title === "string" &&
    Array.isArray(p.columns) &&
    p.columns.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        (c.type === "checkbox" || c.type === "text" || c.type === "number")
    )
  );
}

function hasValidAuth(req) {
  if (!SITE_PASSWORD) return true;
  const m = /(?:^|;\s*)polls_auth=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  return !!m && m[1] === AUTH_HASH;
}

function isProtected(pathname, method) {
  if (!SITE_PASSWORD) return false;
  if (pathname === "/svar.html") return false;
  if (method === "GET" && /^\/api\/polls\/[A-Za-z0-9_-]+$/.test(pathname)) return false;
  if (/^\/api\/polls\/[A-Za-z0-9_-]+\/responses$/.test(pathname)) return false;
  if (pathname.startsWith("/api/")) return true;
  return pathname === "/" || pathname === "/index.html" || pathname === "/admin.html";
}

function loginPage() {
  return '<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login</title><style>body{font-family:system-ui,sans-serif;background:#f4f6f8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);width:320px}input{width:100%;padding:10px;margin:12px 0;border:1px solid #c9d2dc;border-radius:6px;font-size:1rem;box-sizing:border-box}button{width:100%;padding:10px;border:none;border-radius:6px;background:#2b5cff;color:#fff;font-weight:600;cursor:pointer;font-size:1rem}p{font-size:.9rem}</style></head><body><div class="box"><h2 style="margin-top:0">Login</h2><input id="pw" type="password" placeholder="Kodeord" autocomplete="current-password"><button id="go">Log ind</button><p id="err" style="color:#c02626"></p></div><script>document.getElementById("go").onclick=async()=>{const r=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.getElementById("pw").value})});if(r.ok)location.reload();else document.getElementById("err").textContent="Forkert kodeord"};document.getElementById("pw").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("go").click()})</script></body></html>';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/login" && req.method === "POST") {
    const body = await readBody(req);
    if (SITE_PASSWORD && body.password === SITE_PASSWORD) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "polls_auth=" + AUTH_HASH + "; HttpOnly; Path=/; SameSite=Lax" });
      return res.end(JSON.stringify({ ok: true }));
    }
    return sendJson(res, 401, { error: "Forkert kodeord" });
  }

  if (!hasValidAuth(req) && isProtected(pathname, req.method)) {
    if (req.method === "GET" && !pathname.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(loginPage());
    }
    return sendJson(res, 401, { error: "Ikke autoriseret" });
  }

  if (pathname.startsWith("/api/")) {
    const data = loadData();
    const m = pathname.match(/^\/api\/polls\/([A-Za-z0-9_-]+)(\/responses)?$/);
    try {
      if (req.method === "GET" && pathname === "/api/polls") {
        const list = Object.entries(data.polls).map(([id, p]) => ({
          id,
          title: p.title,
          namePrompt: p.namePrompt,
          createdAt: p.createdAt,
          responseCount: p.responses.length
        }));
        list.sort((a, b) => b.createdAt - a.createdAt);
        return sendJson(res, 200, { polls: list });
      }
      if (req.method === "POST" && pathname === "/api/polls") {
        const body = await readBody(req);
        if (!isValidPoll(body)) return sendJson(res, 400, { error: "Ugyldig poll" });
        const id = crypto.randomUUID();
        data.polls[id] = {
          title: body.title.slice(0, 200),
          namePrompt: typeof body.namePrompt === "string" && body.namePrompt.trim() ? body.namePrompt.trim().slice(0, 200) : "Skriv dit navn",
          columns: body.columns,
          createdAt: Date.now(),
          responses: []
        };
        saveData(data);
        return sendJson(res, 201, { id });
      }
      if (m && req.method === "DELETE" && !m[2]) {
        if (!data.polls[m[1]]) return sendJson(res, 404, { error: "Poll ikke fundet" });
        delete data.polls[m[1]];
        saveData(data);
        return sendJson(res, 200, { ok: true });
      }
      if (m) {
        const poll = data.polls[m[1]];
        if (!poll) return sendJson(res, 404, { error: "Poll ikke fundet" });
        if (m[2] === "/responses" && req.method === "GET") {
          return sendJson(res, 200, { responses: poll.responses });
        }
        if (m[2] === "/responses" && req.method === "POST") {
          const body = await readBody(req);
          const name = String(body.name || "").trim().slice(0, 100);
          if (!name) return sendJson(res, 400, { error: "Navn mangler" });
          const answers = {};
          for (const col of poll.columns) {
            const v = body.answers && body.answers[col.id];
            if (col.type === "checkbox") {
              answers[col.id] = v === "ja" || v === "nej" ? v : null;
            } else if (col.type === "number") {
              const n = parseInt(v, 10);
              answers[col.id] = Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
            } else {
              answers[col.id] = typeof v === "string" ? v.slice(0, 2000) : "";
            }
          }
          const existing = poll.responses.find((r) => r.name === name);
          if (existing) {
            existing.answers = answers;
            existing.time = Date.now();
          } else {
            poll.responses.push({ name, time: Date.now(), answers });
          }
          saveData(data);
          return sendJson(res, 200, { ok: true, responses: poll.responses });
        }
        if (req.method === "GET" && !m[2]) {
          return sendJson(res, 200, { poll: { title: poll.title, namePrompt: poll.namePrompt, columns: poll.columns }, responses: poll.responses });
        }
      }
      return sendJson(res, 404, { error: "Not found" });
    } catch (e) {
      return sendJson(res, 400, { error: "Ugyldig forespørgsel" });
    }
  }

  const rel = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Poll-server kører på http://localhost:${PORT}`);
});
