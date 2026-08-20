import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, REQUIRED_DOC_NAMES, GAP_CATEGORY_NAMES } from '../data/assessment';
import '../styles/admin.css';

const STATUSES = ['New', 'Onboarding', 'In Review', 'Inspection Ready', 'On Hold'];

function ReadinessBadge({ value }) {
  if (value === null || value === undefined) return <span className="readiness-badge none">No assessment</span>;
  const cls = value >= 80 ? 'good' : value >= 50 ? 'mid' : 'low';
  return <span className={`readiness-badge ${cls}`}>{value}%</span>;
}

export function AdminDashboard() {
  const { user, logout, api } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null); // { client, assessment, documents }
  const [detailLoading, setDetailLoading] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api('/api/admin/clients');
      setClients(d.clients || []);
    } catch (err) {
      setError(err.message || 'Could not load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (email) => {
    setDetailLoading(true);
    setError('');
    try {
      const d = await api(`/api/admin/clients/${encodeURIComponent(email)}`);
      setSelected(d);
    } catch (err) {
      setError(err.message || 'Could not load client');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (email, status) => {
    try {
      const d = await api(`/api/admin/clients/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setClients((prev) => prev.map((c) => (c.email === email ? { ...c, status: d.client.status } : c)));
      setSelected((prev) => (prev && prev.client.email === email ? { ...prev, client: d.client } : prev));
    } catch (err) {
      setError(err.message || 'Status update failed');
    }
  };

  const shown = clients.filter((c) => filter === 'All' || c.status === filter);
  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: clients.filter((c) => c.status === s).length }), {});

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1>Admin — Lab Readiness Portal</h1>
          <p className="admin-subtitle">Signed in as {user.firstName} {user.lastName} ({user.email})</p>
        </div>
        <button className="link-button" onClick={logout}>Sign out</button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-stats">
        <div className="stat-card"><span className="stat-value">{clients.length}</span><span className="stat-label">Total accounts</span></div>
        {STATUSES.map((s) => (
          <div className="stat-card" key={s}><span className="stat-value">{counts[s] || 0}</span><span className="stat-label">{s}</span></div>
        ))}
      </div>

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="link-button" onClick={loadClients}>Refresh</button>
      </div>

      <div className="admin-layout">
        <section className="client-table-wrap">
          {loading ? <p className="muted">Loading clients…</p> : (
            <table className="client-table">
              <thead>
                <tr>
                  <th>Business</th><th>Contact</th><th>Lab type</th><th>Readiness</th><th>Docs</th><th>Status</th><th>Role</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan="7" className="muted">No accounts{filter !== 'All' ? ` with status "${filter}"` : ' registered yet'}.</td></tr>
                )}
                {shown.map((c) => (
                  <tr key={c.email} className={selected?.client?.email === c.email ? 'selected' : ''} onClick={() => openDetail(c.email)}>
                    <td>{c.businessName}</td>
                    <td>{c.firstName} {c.lastName}<br /><span className="muted small">{c.email}</span></td>
                    <td>{c.labType}</td>
                    <td><ReadinessBadge value={c.readiness} /></td>
                    <td>{c.documentCount}</td>
                    <td>
                      <select
                        value={c.status || 'New'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateStatus(c.email, e.target.value)}
                      >
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{c.role === 'admin' ? <span className="role-badge">Admin</span> : 'Client'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="client-detail">
          {detailLoading && <p className="muted">Loading…</p>}
          {!detailLoading && !selected && <p className="muted">Select a client to view their profile, assessment, and documents.</p>}
          {!detailLoading && selected && (
            <>
              <h3>{selected.client.businessName}</h3>
              <div className="detail-grid">
                <div><span className="detail-label">Contact</span><span>{selected.client.firstName} {selected.client.lastName}</span></div>
                <div><span className="detail-label">Email</span><span>{selected.client.email}</span></div>
                <div><span className="detail-label">Phone</span><span>{selected.client.phone || '—'}</span></div>
                <div><span className="detail-label">Address</span><span>{selected.client.businessAddress || '—'}</span></div>
                <div><span className="detail-label">Lab type</span><span>{selected.client.labType}</span></div>
                <div><span className="detail-label">Registered</span><span>{new Date(selected.client.createdAt).toLocaleString()}</span></div>
              </div>

              <h4>Readiness assessment</h4>
              {!selected.assessment && <p className="muted">Not started.</p>}
              {selected.assessment && (
                <>
                  <p className="detail-overall">Overall: <ReadinessBadge value={selected.assessment.scores.overall} />
                    <span className="muted small"> · updated {new Date(selected.assessment.updatedAt).toLocaleString()}</span>
                  </p>
                  {CATEGORIES.map((cat) => (
                    <div className="category-row" key={cat.id}>
                      <span className="category-name">{cat.name}</span>
                      <span className="category-percent">{selected.assessment.scores.categories[cat.id] ?? 0}%</span>
                    </div>
                  ))}
                </>
              )}

              <h4>Document gaps</h4>
              {!selected.gaps && <p className="muted">No gap data.</p>}
              {selected.gaps && (
                <>
                  <p className="detail-overall">
                    <span className="readiness-badge good">{selected.gaps.counts.found} found</span>{' '}
                    <span className="readiness-badge mid">{selected.gaps.counts.expired} expired</span>{' '}
                    <span className="readiness-badge low">{selected.gaps.counts.missing} missing</span>
                  </p>
                  {selected.gaps.items.filter((i) => i.status !== 'found').length > 0 && (
                    <div className="gap-missing-list">
                      {selected.gaps.items.filter((i) => i.status !== 'found').map((i) => (
                        <div className="category-row" key={i.id}>
                          <span className="category-name">{i.name}</span>
                          <span className={`category-percent ${i.status === 'missing' ? 'gap-text-bad' : 'gap-text-warn'}`}>
                            {i.status === 'missing' ? 'Missing' : `Expired ${i.expirationDate}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <h4>Documents ({selected.documents.length})</h4>
              {selected.documents.length === 0 && <p className="muted">None uploaded.</p>}
              {selected.documents.map((d) => (
                <div className="doc-row" key={d.id}>
                  <div className="doc-info">
                    <span className="doc-name">{d.name}</span>
                    <span className="doc-meta">{d.category} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleDateString()}</span>
                    {d.analysis && (
                      <span className="doc-meta">
                        AI: {REQUIRED_DOC_NAMES[d.analysis.docType] || 'Other'}
                        {d.analysis.expirationDate ? ` · expires ${d.analysis.expirationDate}` : ''}
                        {d.analysis.issues?.length ? ` · ⚠ ${d.analysis.issues.join(', ')}` : ''}
                      </span>
                    )}
                  </div>
                  <a className="link-button" href={`/api/admin/clients/${encodeURIComponent(selected.client.email)}/documents/${d.id}/download`}>Download</a>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
