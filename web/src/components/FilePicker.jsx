import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { fileSize } from '../lib/format.js';

// One dropzone, used by every upload surface — the library, assignment
// submission, anywhere else that takes a file. It replaces two near-identical
// inline-styled buttons that had drifted apart.
//
// It accepts a drop as well as a click, because a dropzone that only opens a
// file dialog is a button wearing a dropzone's clothes.

const FILE_ICON = {
  pdf: 'doc', doc: 'doc', docx: 'doc', txt: 'doc', md: 'doc',
  xls: 'grid', xlsx: 'grid', csv: 'grid',
  ppt: 'layers', pptx: 'layers',
  png: 'eye', jpg: 'eye', jpeg: 'eye', webp: 'eye', heic: 'eye',
};

export default function FilePicker({ file, onChange, accept, hint }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const take = (f) => { if (f) onChange(f); };

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  };

  if (file) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return (
      <div className="picked">
        <span className="picked-icon"><Icon name={FILE_ICON[ext] ?? 'doc'} size={18} /></span>
        <span className="picked-text">
          <span className="picked-name">{file.name}</span>
          <span className="picked-size">{fileSize(file.size)}</span>
        </span>
        <button type="button" className="icon-btn" onClick={() => onChange(null)} aria-label="Remove file">
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className="dropzone-icon"><Icon name="upload" size={20} /></span>
        <span className="dropzone-title">Choose a file<span className="dropzone-or"> or drop it here</span></span>
        {hint && <span className="dropzone-hint">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        onChange={(e) => take(e.target.files?.[0])}
      />
    </>
  );
}
