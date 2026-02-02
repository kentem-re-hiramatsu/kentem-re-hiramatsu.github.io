# setup.ps1 - run from project root to install dependencies and start dev server
Write-Host "Installing npm dependencies..."
npm install

if ($LASTEXITCODE -ne 0) {
  Write-Error "npm install failed. Check your network and npm configuration."
  exit $LASTEXITCODE
}

Write-Host "Starting dev server (npm run dev)..."
npm run dev
