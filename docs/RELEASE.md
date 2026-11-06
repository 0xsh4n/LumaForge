# Releasing Lumetta

Lumetta ships as native installers per platform. Because a Windows `.msi` can
only be produced on Windows (and a `.dmg` on macOS), releases are built by CI,
with one build job per operating system.

## How a release is cut

1. Update the version in `desktop/package.json`, `desktop/src-tauri/Cargo.toml`,
   `desktop/src-tauri/tauri.conf.json` and `backend/pyproject.toml`, and move the
   `[Unreleased]` section of `CHANGELOG.md` under the new version.
2. Tag and push:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
3. The `ci.yml` workflow runs the test job, then builds installers on
   `windows-latest`, `macos-latest` and `ubuntu-latest` in parallel and attaches
   them to a GitHub Release for the tag.

`workflow_dispatch` (the "Run workflow" button) builds the installers without
tagging, for testing.

## What each job produces

| OS | Artifacts |
|----|-----------|
| Windows | `bundle/msi/*.msi`, `bundle/nsis/*-setup.exe` |
| macOS | `bundle/dmg/*.dmg` (and the `.app`) |
| Linux | `bundle/deb/*.deb`, `bundle/appimage/*.AppImage` |

Each job:
1. installs the OS toolchain (Node, Python, Rust; plus WebKitGTK et al. on Linux);
2. creates the Python venv and freezes the backend into the sidecar with
   PyInstaller (`scripts/build_sidecar.*`), named with the Rust target triple and
   placed in `desktop/src-tauri/binaries/`;
3. builds the frontend and the native bundle (`npm run tauri:build`).

## Building locally (one platform)

On the target OS:
```bash
./scripts/setup.sh          # Windows: .\scripts\setup.ps1
./scripts/build.sh          # Windows: .\scripts\build.ps1
```
Outputs land in `desktop/src-tauri/target/release/bundle/`.

The sidecar step alone (useful to validate packaging) is
`scripts/build_sidecar.*`; the resulting `lumetta-backend[-<triple>]` is a
self-contained executable you can run directly:
```bash
./backend/dist/lumetta-backend --port 8756
curl http://127.0.0.1:8756/api/system/health
```

## Code signing & notarization (recommended before public release)

Not configured by default — the installers are unsigned, so users see an
OS warning on first launch. To sign:

- **Windows**: provide an Authenticode certificate and set Tauri's
  `bundle.windows.certificateThumbprint` / signing env vars.
- **macOS**: set an Apple Developer ID signing identity and notarization
  credentials (`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`)
  as repository secrets; Tauri notarizes during `tauri:build`.
- **Linux**: `.deb`/AppImage are typically distributed unsigned; optionally GPG-sign.

Wire the secrets into `ci.yml`'s build job before tagging a public release.

## WebView runtime

The UI renders in the OS webview. On Windows 10/11 **WebView2** is preinstalled;
the installer is configured to fetch it automatically if missing
(`webviewInstallMode: downloadBootstrapper`). macOS uses WKWebView and Linux uses
WebKitGTK — both provided by the OS / the Linux system deps above.
