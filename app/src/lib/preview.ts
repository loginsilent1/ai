const SANDBOX_CSP =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; navigate-to 'none'\">";

/**
 * Parse inertly in the host, put CSP first in a fresh document, then render only in a
 * sandboxed iframe. Malformed prefixes cannot run before the policy is installed.
 */
export function isolatePreviewHtml(source: string): string {
  const html = source.trim();
  if (!html) return "";

  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll('meta[http-equiv="refresh"], base').forEach((node) => node.remove());
  const head = parsed.head.innerHTML;
  const body = parsed.body.innerHTML;
  const title = parsed.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 120);
  return `<!doctype html><html><head>${SANDBOX_CSP}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${title ? `<title>${title}</title>` : ""}${head}</head><body>${body}</body></html>`;
}

export function looksLikeHtml(source: string): boolean {
  return /<!doctype\s+html|<html[\s>]|<body[\s>]/i.test(source);
}
