const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "ui");
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (e, data) => {
      if (e) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        { html: "text/html", css: "text/css", js: "text/javascript" }[
          path.extname(file).slice(1)
        ] || "application/octet-stream",
      );
      res.end(data);
    });
  })
  .listen(4173, "127.0.0.1", () =>
    console.log(
      "VEXON interface preview: http://127.0.0.1:4173 (no desktop controls)",
    ),
  );
