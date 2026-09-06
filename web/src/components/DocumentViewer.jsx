import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../lib/toast.jsx';
import Icon from './Icon.jsx';
import { Badge, Button, Note, SkeletonList } from './ui.jsx';
import { FILE_LABELS, fileSize, formatDate } from '../lib/format.js';

/* The document viewer.
 *
 * The old detail dialog showed *metadata about* a document — its type, its
 * version, how it had been chunked. What it never showed was the document.
 * This is the Preview-style split the owner asked for: the file itself on the
 * left, and what the model read out of it on the right.
 *
 * PDFs and images render natively. Everything else (Word, Excel, slides, plain
 * text) has no in-browser renderer, so the left pane falls back to the indexed
 * passages — which is not a consolation prize: it is precisely the text the
 * assistant is able to quote, laid out in reading order.
 */

const NATIVE = { pdf: 'frame', image: 'image' };

/** Fetches the file as a blob URL, because a bearer-token route cannot be put
 *  in an `<iframe src>`. Revokes on unmount and whenever the id changes. */
function useFileBlob(id, enabled) {
  const [state, setState] = useState({ url: null, error: null, loading: enabled });
  const urlRef = useRef(null);

  useEffect(() => {
    if (!enabled) { setState({ url: null, error: null, loading: false }); return undefined; }
    let live = true;
    const controller = new AbortController();
    setState({ url: null, error: null, loading: true });
    api.fileBlob('documents', id, { signal: controller.signal })
      .then(({ url }) => {
        if (!live) { URL.revokeObjectURL(url); return; }
        urlRef.current = url;
        setState({ url, error: null, loading: false });
      })
      .catch((err) => {
        if (live && err.name !== 'AbortError') setState({ url: null, error: err.message, loading: false });
      });
    return () => {
      live = false;
      controller.abort();
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [id, enabled]);

  return state;
}

function Analysis({ doc, canAnalyse, onAnalysed }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const analysis = doc.analysis;

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.analyseDocument(doc.id);
      if (res.analysis?.status === 'ready') toast.success('Read and summarised.');
      else toast.error(res.analysis?.reason ?? 'The document could not be analysed.');
      onAnalysed();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rerunButton = canAnalyse && (
    <Button size="sm" icon="sparkle" onClick={run} disabled={busy}>
      {busy ? 'Reading…' : analysis?.status === 'ready' ? 'Analyse again' : 'Analyse with AI'}
    </Button>
  );

  if (!analysis || analysis.status !== 'ready') {
    return (
      <section className="viewer-block">
        <div className="viewer-block-head">
          <h3 className="viewer-block-title">What the AI read</h3>
          {rerunButton}
        </div>
        {analysis?.status === 'running'
          ? <Note icon="clock">Reading the document now. This takes a few seconds for text, longer for a scan.</Note>
          : analysis?.reason
            ? <Note tone="warn" icon="alert">{analysis.reason}</Note>
            : (
              <p className="viewer-empty">
                This document has not been analysed yet.
                {canAnalyse ? ' Run it and the summary, topics and dates appear here.' : ''}
              </p>
            )}
      </section>
    );
  }

  return (
    <>
      <section className="viewer-block">
        <div className="viewer-block-head">
          <h3 className="viewer-block-title">Summary</h3>
          {rerunButton}
        </div>
        <p className="viewer-summary">{analysis.summary}</p>
        <div className="row wrap" style={{ gap: 6, marginTop: 'var(--s4)' }}>
          {analysis.docType && <Badge tone="sky">{analysis.docType}</Badge>}
          {analysis.audience && <Badge>For {analysis.audience}</Badge>}
          {analysis.transcribed && <Badge tone="warn">Text read from the page</Badge>}
        </div>
      </section>

      {analysis.topics?.length > 0 && (
        <section className="viewer-block">
          <h3 className="viewer-block-title">Topics covered</h3>
          <ul className="viewer-topics">
            {analysis.topics.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}

      {analysis.dates?.length > 0 && (
        <section className="viewer-block">
          <h3 className="viewer-block-title">Dates it commits to</h3>
          <dl className="viewer-dates">
            {analysis.dates.map((d) => (
              <div className="viewer-date" key={`${d.label}-${d.value}`}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {analysis.tags?.length > 0 && (
        <section className="viewer-block">
          <h3 className="viewer-block-title">Tags</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {analysis.tags.map((t) => <span className="badge" key={t}>#{t}</span>)}
          </div>
        </section>
      )}
    </>
  );
}

export default function DocumentViewer({ id, onClose }) {
  const toast = useToast();
  const { data, loading, refetch } = useApi(() => api.document(id), [id]);
  const doc = data?.document;
  const render = doc ? NATIVE[doc.fileType] : null;
  const { url, error: fileError, loading: fileLoading } = useFileBlob(id, Boolean(doc?.storedName && render));

  const panelRef = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  const download = async () => {
    try { await api.downloadFile('documents', id, doc?.fileName); }
    catch (err) { toast.error(err.message); }
  };

  const body = () => {
    if (fileLoading) return <div className="viewer-status"><span className="spinner" />Loading the document…</div>;
    if (fileError) return <div className="viewer-status"><Icon name="alert" size={18} />{fileError}</div>;
    if (render === 'frame' && url) {
      return <iframe className="viewer-frame" src={url} title={doc.title} />;
    }
    if (render === 'image' && url) {
      return <div className="viewer-image-wrap"><img className="viewer-image" src={url} alt={doc.title} /></div>;
    }
    // No native renderer for this format. Show the text the assistant holds,
    // in reading order — the closest honest thing to the document itself.
    if (data?.passages?.length) {
      return (
        <article className="viewer-text">
          {data.passages.map((p, i) => (
            <section key={i}>
              {p.section && <h4 className="viewer-text-head">{p.section}</h4>}
              <p>{p.text}</p>
            </section>
          ))}
        </article>
      );
    }
    return (
      <div className="viewer-status">
        <Icon name="doc" size={18} />
        {doc?.storedName
          ? 'This format has no in-browser preview. Download it to read the original.'
          : 'This is seeded demo content with no original file attached.'}
      </div>
    );
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef} tabIndex={-1}
        className="viewer" role="dialog" aria-modal="true"
        aria-label={doc?.title ?? 'Document'}
      >
        <header className="viewer-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <h2 className="viewer-title">{doc?.title ?? 'Document'}</h2>
            {doc && (
              <p className="viewer-sub">
                {doc.fileName} · {FILE_LABELS[doc.fileType] ?? doc.fileType}
                {doc.sizeBytes ? ` · ${fileSize(doc.sizeBytes)}` : ''} · {doc.uploader}
              </p>
            )}
          </div>
          {doc?.storedName && (
            <Button size="sm" variant="ghost" className="btn-icon" onClick={download} aria-label="Download">
              <Icon name="download" size={16} />
            </Button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </header>

        <div className="viewer-body">
          <div className="viewer-doc">{loading ? <div className="viewer-status"><span className="spinner" />Loading…</div> : body()}</div>

          <aside className="viewer-side">
            {loading ? <SkeletonList rows={4} /> : doc && (
              <>
                {doc.superseded && (
                  <Note tone="warn" icon="alert">
                    Superseded. It stays readable here, but the assistant will never quote it.
                  </Note>
                )}

                <Analysis doc={doc} canAnalyse={Boolean(data?.canAnalyse)} onAnalysed={refetch} />

                <section className="viewer-block">
                  <h3 className="viewer-block-title">Document facts</h3>
                  <dl className="viewer-facts">
                    <div><dt>Version</dt><dd>v{doc.version}</dd></div>
                    <div><dt>Indexed</dt><dd>{doc.chunkCount} passages</dd></div>
                    <div><dt>Pages</dt><dd>{doc.pages}</dd></div>
                    <div><dt>Scope</dt><dd>{doc.branch === 'ALL' ? 'All branches' : doc.branch}{doc.semester ? ` · sem ${doc.semester}` : ''}</dd></div>
                    <div><dt>Uploaded</dt><dd>{formatDate(doc.uploadedAt)}</dd></div>
                  </dl>
                </section>

                {data.sections?.length > 0 && (
                  <section className="viewer-block">
                    <h3 className="viewer-block-title">Sections detected</h3>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {data.sections.map((sec) => <span className="badge" key={sec}>{sec}</span>)}
                    </div>
                  </section>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
