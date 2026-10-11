/* A static file server, for testing the site without pushing.
   Node only, no dependencies — serve.bat falls back to this when Python
   isn't on the machine. */
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json", ".svg":"image/svg+xml",
  ".png":"image/png", ".jpg":"image/jpeg", ".ico":"image/x-icon",
  ".ttf":"font/ttf", ".otf":"font/otf", ".woff2":"font/woff2"};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if(p === "/") p = "/index.html";
  /* stay inside the folder: a served site is still a server */
  const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if(!file.startsWith(root)){ res.writeHead(403).end("no"); return; }
  fs.readFile(file, (err, buf) => {
    if(err){ res.writeHead(404, {"content-type":"text/plain"}).end("404 " + p); return; }
    res.writeHead(200, {"content-type": TYPES[path.extname(file)] || "application/octet-stream",
                        "cache-control": "no-store"});
    res.end(buf);
  });
}).listen(8080, () => console.log("Serving " + root + " at http://localhost:8080"));
