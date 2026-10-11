# A static file server in PowerShell, so the site can be tested with nothing
# installed. Windows ships PowerShell; it does not ship Python or Node.
#
# http://localhost:PORT/ is one of the few prefixes HttpListener allows a
# normal user to bind, which is why this does not need an admin prompt.
param([int]$Port = 8080)

$root = Split-Path -Parent $PSScriptRoot          # the folder above tools\
$types = @{
  ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8";
  ".css"="text/css; charset=utf-8";   ".json"="application/json";
  ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg";
  ".jpeg"="image/jpeg";   ".ico"="image/x-icon"; ".webm"="video/webm";
  ".ttf"="font/ttf"; ".otf"="font/otf"; ".woff2"="font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
  Write-Host ""
  Write-Host "  Could not open port $Port - something else may already be using it."
  Write-Host "  Close it, or run:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 8081"
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "  Serving $root"
Write-Host "  Open  http://localhost:$Port/create.html"
Write-Host "  Demo  http://localhost:$Port/demo-plans.html"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path -eq "/") { $path = "/index.html" }
  $file = Join-Path $root ($path.TrimStart("/") -replace "/","\")
  # stay inside the folder: a served site is still a server
  $full = [System.IO.Path]::GetFullPath($file)
  if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) {
    $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue
  }
  if (Test-Path $full -PathType Leaf) {
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" })
    $ctx.Response.Headers.Add("Cache-Control","no-store")
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 $path")
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.Close()
}

