import { useMemo } from "react";
import { LockKeyhole, Maximize2, Sparkles, X } from "lucide-react";
import { isolatePreviewHtml } from "../lib/preview";

interface AppPreviewProps {
  html: string | null;
  onExpand: () => void;
}

export function AppPreview({ html, onExpand }: AppPreviewProps) {
  const srcDoc = useMemo(() => html ? isolatePreviewHtml(html) : "", [html]);
  return (
    <section className="preview-pane">
      <div className="preview-pane-heading">
        <div className="preview-heading-title"><span className="preview-live-dot" /><span>LIVE CANVAS</span><span className="preview-sandbox-tag"><LockKeyhole size={11} /> Sandbox</span></div>
        <button className="icon-button subtle-icon-button" onClick={onExpand} aria-label="Expand app preview" disabled={!html}><Maximize2 size={15} /></button>
      </div>
      {html ? (
        <iframe
          className="preview-frame"
          title="Generated app preview"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={srcDoc}
        />
      ) : (
        <div className="preview-placeholder">
          <div className="preview-placeholder-art"><Sparkles size={25} /></div>
          <strong>Your next little app</strong>
          <span>Describe a calculator, tracker, study tool, or mini-game. Argon will build it here.</span>
          <div className="preview-placeholder-chips"><i>offline-friendly</i><i>touch-ready</i><i>private sandbox</i></div>
        </div>
      )}
      <div className="preview-pane-footer"><LockKeyhole size={12} /> Isolated preview · CSP restricts app requests and external content.</div>
    </section>
  );
}

interface PreviewModalProps {
  html: string;
  onClose: () => void;
}

export function PreviewModal({ html, onClose }: PreviewModalProps) {
  const srcDoc = useMemo(() => isolatePreviewHtml(html), [html]);
  return (
    <div className="preview-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="preview-modal" role="dialog" aria-modal="true" aria-label="App preview">
        <header className="preview-modal-header">
          <div><span className="preview-live-dot" /><strong>APP STUDIO PREVIEW</strong><span className="preview-sandbox-tag"><LockKeyhole size={11} /> Isolated</span></div>
          <button className="icon-button" onClick={onClose} aria-label="Close preview"><X size={18} /></button>
        </header>
        <iframe className="preview-modal-frame" title="Generated app preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} />
        <footer className="preview-modal-footer"><span><LockKeyhole size={12} /> Isolated from app files and account data; CSP restricts requests.</span><button className="modal-done" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  );
}
