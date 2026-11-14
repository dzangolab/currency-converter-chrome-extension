# List the available recipes
default:
    @just --list

# Run the tests, then zip extension/ into dist/ for the Chrome Web Store
build: test
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(node -p "require('./extension/manifest.json').version")
    zip_file="dist/historical-currency-converter-${version}.zip"
    mkdir -p dist
    rm -f "$zip_file"
    # Zip the folder's contents, not the folder, so manifest.json sits at the
    # top of the archive as the store requires; skip hidden files (.DS_Store).
    (cd extension && zip -qr "../$zip_file" . -x '.*' '*/.*')
    echo "Built $zip_file"
    unzip -l "$zip_file"

# Run the Jest suite (only this repo's tests, not those of any agent worktree)
test:
    npx jest --testPathIgnorePatterns=/node_modules/ /.claude/
