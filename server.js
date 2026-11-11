const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const ROOT = __dirname;

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    const data = loadData();
    const m = pathname.match(/^\/api\/polls\/([A-Za-z0-9_-]+)(\/responses)?$/);
    try {
      if (req.method === "POST" && pathname === "/api/polls") {
        const body = await readBody(req);
        if (!isValidPoll(body)) return sendJson(res, 400, { error: "Ugyldig poll" });
        const id = crypto.randomUUID();
        data.polls[id] = {
          title: body.title.slice(0, 200),
          columns: body.columns,
          createdAt: Date.now(),
          responses: []
        };
        saveData(data);
        return sendJson(res, 201, { id });
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
          return sendJson(res, 200, { poll: { title: poll.title, columns: poll.columns }, responses: poll.responses });
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
