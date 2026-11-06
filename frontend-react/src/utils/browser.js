// Saves a Blob as a file via a temporary object URL.
export function downloadBlob(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

// Older versions kept write-only click histories and per-page state blobs in localStorage.
// Nothing reads them anymore, so clear them once on startup.
const LEGACY_KEY =
  /^rankit_(.+_actions(_.*)?|(admin|superadmin|grievance|tabulator|login|community)_state(_.*)?|auth)$/;

export function purgeLegacyStorage() {
  try {
    Object.keys(localStorage)
      .filter((key) => LEGACY_KEY.test(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch (_error) {
    // Storage unavailable; nothing to clean.
  }
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);
