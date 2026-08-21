import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, ANSWER_OPTIONS, DOCUMENT_CATEGORIES, REQUIRED_DOC_NAMES, GAP_CATEGORY_NAMES } from '../data/assessment';
import { QuestionnairePanel } from './QuestionnairePanel';
import '../styles/dashboard.css';

function ScoreRing({ value }) {
  const pct = value ?? 0;
  const color = pct >= 80 ? '#0F6E56' : pct >= 50 ? '#BA7517' : '#c0392b';
  return (
    <div className="score-ring" style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #e8e8ef 0deg)` }}>
      <div className="score-ring-inner">
        <span className="score-ring-value">{value === null ? '—' : `${pct}%`}</span>
        <span className="score-ring-label">Readiness</span>
      </div>
    </div>
  );
}

function CategoryBar({ name, value }) {
  const color = value >= 80 ? '#0F6E56' : value >= 50 ? '#BA7517' : '#c0392b';
  return (
    <div className="category-row">
      <span className="category-name">{name}</span>
      <div className="category-track">
        <div className="category-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="category-percent" style={{ color }}>{value}%</span>
    </div>
  );
}

export function UserDashboard() {
  const { user, logout, api } = useAuth();
  const [tab, setTab] = useState('assessment');

  // assessment state
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [assessError, setAssessError] = useState('');

  // documents state
  const [documents, setDocuments] = useState([]);
  const [docCategory, setDocCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total, current }
  const [dragOver, setDragOver] = useState(false);
  const [docError, setDocError] = useState('');
  const [analyzing, setAnalyzing] = useState({});
  const [aiNotice, setAiNotice] = useState('');
  const [gaps, setGaps] = useState(null);
  const fileInputRef = useRef(null);

  const refreshGaps = () => {
    api('/api/gaps').then((d) => setGaps(d.gaps)).catch(() => {});
  };

  useEffect(() => {
    api('/api/assessment').then((d) => {
      if (d.assessment) {
        setAnswers(d.assessment.answers || {});
        setScores(d.assessment.scores || null);
        setSavedAt(d.assessment.updatedAt || null);
      }
    }).catch(() => {});
    api('/api/documents').then((d) => setDocuments(d.documents || [])).catch(() => {});
    api('/api/gaps').then((d) => setGaps(d.gaps)).catch(() => {});
  }, [api]);

  const analyzeDoc = async (id) => {
    setAnalyzing((prev) => ({ ...prev, [id]: true }));
    setAiNotice('');
    try {
      const d = await api(`/api/documents/${id}/analyze`, { method: 'POST' });
      setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, analysis: d.analysis } : doc)));
      refreshGaps();
    } catch (err) {
      if (err.status === 501) setAiNotice(err.message);
      else setDocError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const totalQuestions = useMemo(() => CATEGORIES.reduce((n, c) => n + c.questions.length, 0), []);

  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const saveAssessment = async () => {
    setSaving(true);
    setAssessError('');
    try {
      const d = await api('/api/assessment', { method: 'PUT', body: JSON.stringify({ answers }) });
      setScores(d.assessment.scores);
      setSavedAt(d.assessment.updatedAt);
    } catch (err) {
      setAssessError(err.message || 'Could not save assessment');
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setDocError('');
    const tooBig = files.filter((f) => f.size > 5 * 1024 * 1024);
    const ok = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (tooBig.length) {
      setDocError(`Skipped (over the 5 MB limit): ${tooBig.map((f) => f.name).join(', ')}`);
    }
    if (!ok.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: ok.length, current: ok[0].name });
    const failed = [];
    for (let i = 0; i < ok.length; i++) {
      const file = ok[i];
      setUploadProgress({ done: i, total: ok.length, current: file.name });
      try {
        const dataBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const d = await api('/api/documents', {
          method: 'POST',
          body: JSON.stringify({
            name: file.name,
            category: docCategory,
            contentType: file.type || 'application/octet-stream',
            dataBase64,
          }),
        });
        setDocuments((prev) => [d.document, ...prev]);
        analyzeDoc(d.document.id); // kick off AI analysis automatically
      } catch (err) {
        failed.push(`${file.name} (${err.message || 'upload failed'})`);
      }
    }
    setUploadProgress(null);
    setUploading(false);
    if (failed.length) setDocError(`Failed to upload: ${failed.join('; ')}`);
  };

  const onFileChosen = (e) => {
    const files = e.target.files;
    uploadFiles(files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer?.files);
  };

  const deleteDoc = async (id) => {
    try {
      await api(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      refreshGaps();
    } catch (err) {
      setDocError(err.message || 'Delete failed');
    }
  };

  return (
    <div className="dash-container">
      <header className="dash-header">
        <div>
          <h1>Lab Readiness Portal</h1>
          <p className="dash-subtitle">{user.businessName} · {user.labType} Laboratory</p>
        </div>
        <div className="dash-header-right">
          <span className={`status-pill status-${(user.status || 'New').replace(/\s/g, '-').toLowerCase()}`}>{user.status || 'New'}</span>
          <button className="link-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="dash-tabs">
        <button className={tab === 'assessment' ? 'active' : ''} onClick={() => setTab('assessment')}>Readiness Assessment</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button className={tab === 'forms' ? 'active' : ''} onClick={() => setTab('forms')}>License Forms</button>
        <button className={tab === 'gaps' ? 'active' : ''} onClick={() => { setTab('gaps'); refreshGaps(); }}>
          Compliance Gaps{gaps && gaps.counts.missing + gaps.counts.expired > 0 ? ` (${gaps.counts.missing + gaps.counts.expired})` : ''}
        </button>
        <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>Account</button>
      </nav>

      {tab === 'assessment' && (
        <div className="dash-grid">
          <section className="card score-card">
            <ScoreRing value={scores ? scores.overall : null} />
            <div className="score-side">
              <p className="score-caption">
                {scores
                  ? scores.overall >= 80
                    ? 'Strong position — keep records current and address remaining gaps.'
                    : scores.overall >= 50
                      ? 'On your way — focus on the lowest-scoring categories below.'
                      : 'Early stage — the categories below show where to start.'
                  : `Answer the ${totalQuestions} questions to generate your readiness score.`}
              </p>
              <p className="score-meta">
                {answeredCount}/{totalQuestions} answered
                {savedAt && ` · Saved ${new Date(savedAt).toLocaleString()}`}
              </p>
              {scores && (
                <div className="score-categories">
                  {CATEGORIES.map((c) => (
                    <CategoryBar key={c.id} name={c.name} value={scores.categories[c.id] ?? 0} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {assessError && <div className="error-banner">{assessError}</div>}

          {CATEGORIES.map((cat) => (
            <section className="card" key={cat.id}>
              <h3 className="card-title">{cat.name}</h3>
              {cat.questions.map((q) => (
                <div className="question-row" key={q.id}>
                  <span className="question-text">{q.text}</span>
                  <div className="answer-buttons">
                    {ANSWER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={`answer-button ${answers[q.id] === opt.value ? 'selected' : ''}`}
                        onClick={() => setAnswer(q.id, opt.value)}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}

          <div className="save-bar">
            <button className="submit-button save-button" onClick={saveAssessment} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Score Assessment'}
            </button>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="dash-grid">
          <section className="card">
            <h3 className="card-title">Upload compliance documents</h3>
            <p className="muted">Select or drag in several files at once · All file types accepted (PDF, images, Word, Excel…) · PDFs and images also get AI analysis · 5 MB max per file</p>
            {docError && <div className="error-banner">{docError}</div>}
            {aiNotice && <div className="notice-banner">{aiNotice}</div>}
            <div
              className={`upload-dropzone${dragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="upload-row">
                <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                  {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={onFileChosen} />
                <button className="submit-button upload-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading && uploadProgress
                    ? `Uploading ${uploadProgress.done + 1}/${uploadProgress.total}…`
                    : 'Choose Files & Upload'}
                </button>
              </div>
              <p className="muted small upload-hint">
                {uploading && uploadProgress ? `Uploading ${uploadProgress.current}` : '…or drag and drop files anywhere in this box'}
              </p>
            </div>
          </section>

          <section className="card">
            <h3 className="card-title">Your documents ({documents.length})</h3>
            {documents.length === 0 && <p className="muted">No documents uploaded yet.</p>}
            {documents.map((d) => (
              <div className="doc-row doc-row-tall" key={d.id}>
                <div className="doc-info">
                  <span className="doc-name">{d.name}</span>
                  <span className="doc-meta">{d.category} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString()}</span>
                  {d.analysis ? (
                    <span className="doc-analysis">
                      <span className="analysis-chip">{REQUIRED_DOC_NAMES[d.analysis.docType] || 'Other'}</span>
                      {d.analysis.expirationDate && (
                        <span className={`analysis-chip ${d.analysis.expirationDate < new Date().toISOString().slice(0, 10) ? 'chip-bad' : 'chip-ok'}`}>
                          {d.analysis.expirationDate < new Date().toISOString().slice(0, 10) ? 'Expired ' : 'Expires '}{d.analysis.expirationDate}
                        </span>
                      )}
                      {d.analysis.signed === false && <span className="analysis-chip chip-warn">Unsigned</span>}
                      {d.analysis.issues?.map((iss, i) => <span className="analysis-chip chip-warn" key={i}>{iss}</span>)}
                    </span>
                  ) : (
                    <span className="doc-analysis">
                      {analyzing[d.id]
                        ? <span className="analysis-chip">Analyzing…</span>
                        : <button className="link-button small" onClick={() => analyzeDoc(d.id)}>Run AI analysis</button>}
                    </span>
                  )}
                </div>
                <div className="doc-actions">
                  <a className="link-button" href={`/api/documents/${d.id}/download`}>Download</a>
                  <button className="link-button danger" onClick={() => deleteDoc(d.id)}>Remove</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'forms' && (
        <div className="dash-grid">
          <section className="card">
            <h3 className="card-title">State licensing forms</h3>
            <p className="muted">
              Fill out this questionnaire once — we generate the right application forms for every state you operate in,
              pre-filled with your answers. The same information lands in the right box on each form even when states
              word things differently (one state's "facility" is another's "laboratory").
            </p>
          </section>
          <QuestionnairePanel
            api={api}
            questionnairePath="/api/questionnaire"
            formDownloadPath="/api/forms"
          />
        </div>
      )}

      {tab === 'gaps' && (
        <div className="dash-grid">
          <section className="card">
            <h3 className="card-title">Document gap analysis</h3>
            {!gaps && <p className="muted">Loading…</p>}
            {gaps && !gaps.aiConfigured && (
              <div className="notice-banner">AI analysis isn't configured yet — gap detection activates once the site owner adds an Anthropic API key in Netlify.</div>
            )}
            {gaps && gaps.analyzedCount === 0 && gaps.aiConfigured && (
              <p className="muted">Upload documents in the Documents tab — each one is analyzed automatically and checked off this list.</p>
            )}
            {gaps && (
              <div className="gap-counts">
                <span className="readiness-chip chip-ok">{gaps.counts.found} found</span>
                <span className="readiness-chip chip-warn">{gaps.counts.expired} expired</span>
                <span className="readiness-chip chip-bad">{gaps.counts.missing} missing</span>
              </div>
            )}
          </section>

          {gaps && Object.entries(GAP_CATEGORY_NAMES).map(([catId, catName]) => {
            const items = gaps.items.filter((i) => i.category === catId);
            if (!items.length) return null;
            return (
              <section className="card" key={catId}>
                <h3 className="card-title">{catName}</h3>
                {items.map((item) => (
                  <div className="gap-row" key={item.id}>
                    <span className={`gap-status gap-${item.status}`}>
                      {item.status === 'found' ? '✓' : item.status === 'expired' ? '!' : '✗'}
                    </span>
                    <span className="gap-name">{item.name}</span>
                    <span className="gap-detail muted small">
                      {item.status === 'found' && `${item.docName}${item.expirationDate ? ` · expires ${item.expirationDate}` : ''}`}
                      {item.status === 'expired' && `${item.docName} · expired ${item.expirationDate}`}
                      {item.status === 'missing' && 'Not on file'}
                    </span>
                  </div>
                ))}
              </section>
            );
          })}

          {gaps && gaps.flagged.length > 0 && (
            <section className="card">
              <h3 className="card-title">Documents with issues</h3>
              {gaps.flagged.map((f) => (
                <div className="gap-row" key={f.docId}>
                  <span className="gap-status gap-expired">!</span>
                  <span className="gap-name">{f.docName}</span>
                  <span className="gap-detail muted small">{f.issues.join(' · ')}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'account' && (
        <div className="dash-grid">
          <section className="card">
            <h3 className="card-title">Account details</h3>
            <div className="detail-grid">
              <div><span className="detail-label">Name</span><span>{user.firstName} {user.lastName}</span></div>
              <div><span className="detail-label">Email</span><span>{user.email}</span></div>
              <div><span className="detail-label">Phone</span><span>{user.phone || '—'}</span></div>
              <div><span className="detail-label">Business</span><span>{user.businessName}</span></div>
              <div><span className="detail-label">Address</span><span>{user.businessAddress || '—'}</span></div>
              <div><span className="detail-label">Lab type</span><span>{user.labType}</span></div>
              <div><span className="detail-label">Member since</span><span>{new Date(user.createdAt).toLocaleDateString()}</span></div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
