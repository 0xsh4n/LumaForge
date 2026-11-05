# PyInstaller spec for the LumaForge backend sidecar.
#
# Build:  pyinstaller lumaforge-backend.spec --noconfirm
# Output: dist/lumaforge-backend  (a single self-contained executable)
#
# The onefile executable is then renamed to the Rust target triple and copied
# into desktop/src-tauri/binaries/ by scripts/build_sidecar.(sh|ps1).

from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hiddenimports = [], [], []

# Collect everything these packages need — they use dynamic imports and data
# files that a naive analysis would miss.
for pkg in ("cv2", "numpy", "PIL", "uvicorn", "fastapi", "starlette",
            "pydantic", "pydantic_core", "anyio"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Optional codecs — collect only if installed (rawpy bundles LibRaw's shared lib;
# pillow_heif bundles libheif). Missing ones are simply skipped.
for pkg in ("rawpy", "pillow_heif"):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

# uvicorn selects its protocol/loop implementations at runtime.
hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
    "app.routers.images",
    "app.routers.process",
    "app.routers.projects",
    "app.routers.system",
]

block_cipher = None

a = Analysis(
    ["run_backend.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PyQt5", "PySide6"],
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="lumaforge-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
