import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, ANSWER_OPTIONS, DOCUMENT_CATEGORIES } from '../data/assessment';
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
  const [docError, setDocError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    api('/api/assessment').then((d) => {
      if (d.assessment) {
        setAnswers(d.assessment.answers || {});
        setScores(d.assessment.scores || null);
        setSavedAt(d.assessment.updatedAt || null);
      }
    }).catch(() => {});
    api('/api/documents').then((d) => setDocuments(d.documents || [])).catch(() => {});
  }, [api]);

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

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setDocError('File exceeds the 5 MB limit');
      return;
    }
    setUploading(true);
    setDocError('');
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
    } catch (err) {
      setDocError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (id) => {
    try {
      await api(`/api/documents/${id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
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
            <h3 className="card-title">Upload a compliance document</h3>
            <p className="muted">PDF, Word, Excel, or images · 5 MB max per file</p>
            {docError && <div className="error-banner">{docError}</div>}
            <div className="upload-row">
              <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileChosen} />
              <button className="submit-button upload-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Choose File & Upload'}
              </button>
            </div>
          </section>

          <section className="card">
            <h3 className="card-title">Your documents ({documents.length})</h3>
            {documents.length === 0 && <p className="muted">No documents uploaded yet.</p>}
            {documents.map((d) => (
              <div className="doc-row" key={d.id}>
                <div className="doc-info">
                  <span className="doc-name">{d.name}</span>
                  <span className="doc-meta">{d.category} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString()}</span>
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
