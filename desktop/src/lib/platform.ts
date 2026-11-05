// Abstracts the few operations that differ between the Tauri desktop shell
// (native file dialogs, import by absolute path) and a plain browser (file
// upload / blob download). The rest of the app is identical in both, which
// keeps the UI testable in a normal browser during development.

const IMPORT_EXTS = [
  "jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff",
  "heic", "heif",
  "dng", "cr2", "cr3", "nef", "arw", "raf", "rw2", "orf", "pef", "srw",
];

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type ImportPick =
  | { kind: "path"; path: string; name: string }
  | { kind: "file"; file: File }
  | null;

/** Open a file picker and return either a native path (Tauri) or a File (web). */
export async function pickImageToImport(): Promise<ImportPick> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: IMPORT_EXTS }],
    });
    if (typeof selected === "string") {
      const name = selected.split(/[\\/]/).pop() || "image";
      return { kind: "path", path: selected, name };
    }
    return null;
  }
  // Browser fallback: hidden <input type=file>.
  return new Promise<ImportPick>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMPORT_EXTS.map((e) => "." + e).join(",");
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? { kind: "file", file } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Choose a save path (Tauri). Returns null in the browser (download instead). */
export async function pickSavePath(
  defaultName: string,
  format: string,
): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    return path ?? null;
  }
  return null;
}

/** Pick a single file matching an accept list (uses the webview file input,
 *  which works in both Tauri and the browser). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Trigger a browser download of a blob (web export fallback). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
