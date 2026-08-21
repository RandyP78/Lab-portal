import React, { useEffect, useState } from 'react';
import {
  EMPTY_QUESTIONNAIRE, US_STATES, STATE_NAMES, STATES_WITH_SPECIFIC_FORMS, OWNERSHIP_TYPES,
  CERTIFICATE_TYPES, ACCREDITING_ORGS, PERSONNEL_ROLES, DAYS, DIRECTOR_LICENSE_TYPES,
  SELECTABLE_STATES, NY_DISCLAIMER,
  TRIAGE_STATEMENT, COMPLEXITY_LEVELS, TRIAGE_QUESTIONS, APPLICATION_TYPE_LABELS,
} from '../data/questionnaire';
import '../styles/dashboard.css';

// Deep-merge saved data over the empty template so new fields never break old saves
function mergeQ(saved) {
  const base = JSON.parse(JSON.stringify(EMPTY_QUESTIONNAIRE));
  if (!saved) return base;
  const merged = { ...base, ...saved };
  for (const k of ['lab', 'mailing', 'ownership', 'license', 'director', 'contact', 'preparedBy', 'triage']) {
    merged[k] = { ...base[k], ...(saved[k] || {}) };
  }
  merged.triage.answers = { ...(saved.triage?.answers || {}) };
  merged.lab.hours = { ...(saved.lab?.hours || {}) };
  for (const k of ['owners', 'personnel', 'assistants', 'associatedLabs', 'targetStates']) {
    merged[k] = Array.isArray(saved[k]) ? saved[k] : base[k];
  }
  return merged;
}

function Field({ label, children, wide }) {
  return (
    <label className={`q-field${wide ? ' q-wide' : ''}`}>
      <span className="q-label">{label}</span>
      {children}
    </label>
  );
}

export function QuestionnairePanel({ api, questionnairePath, formDownloadPath, compact }) {
  const [q, setQ] = useState(null);
  const [packet, setPacket] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setQ(null);
    api(questionnairePath)
      .then((d) => {
        setQ(mergeQ(d.questionnaire));
        setPacket(d.packet || []);
        setSavedAt(d.questionnaire?.updatedAt || null);
      })
      .catch((err) => { setQ(mergeQ(null)); setError(err.message || 'Could not load questionnaire'); });
  }, [api, questionnairePath]);

  if (!q) return <p className="muted">Loading questionnaire…</p>;

  const set = (path, value) => {
    setQ((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let node = next;
      for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
      node[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const setRow = (listKey, idx, field, value) => {
    setQ((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[listKey][idx][field] = value;
      return next;
    });
  };
  const addRow = (listKey, template) => setQ((prev) => ({ ...prev, [listKey]: [...prev[listKey], { ...template }] }));

  // Personnel can hold several roles at once (e.g. GS + TC)
  const personRoles = (p) => (Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []));
  const togglePersonRole = (idx, role) => {
    setQ((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const p = next.personnel[idx];
      const roles = Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []);
      p.roles = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
      delete p.role;
      return next;
    });
  };
  const removeRow = (listKey, idx) => setQ((prev) => ({ ...prev, [listKey]: prev[listKey].filter((_, i) => i !== idx) }));

  // Triage: the first question answered "yes" (in order) decides the paperwork path;
  // all "no" falls through to major-changes with the free-text message.
  const deriveApplicationType = (answers) => {
    for (const tq of TRIAGE_QUESTIONS) {
      if (answers[tq.id] === 'yes') return tq.type;
    }
    return TRIAGE_QUESTIONS.every((tq) => answers[tq.id] === 'no') ? 'changes' : '';
  };
  const setTriageAnswer = (id, value) => {
    setQ((prev) => {
      const answers = { ...prev.triage.answers, [id]: value };
      return { ...prev, triage: { ...prev.triage, answers, applicationType: deriveApplicationType(answers) } };
    });
  };
  const triageType = q.triage.applicationType;
  const triageDone = q.triage.accepted && q.lab.state && q.targetStates.length > 0 && q.triage.complexity && triageType;

  const toggleTargetState = (code) => {
    setQ((prev) => ({
      ...prev,
      targetStates: prev.targetStates.includes(code)
        ? prev.targetStates.filter((s) => s !== code)
        : [...prev.targetStates, code],
    }));
  };

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const d = await api(questionnairePath, { method: 'PUT', body: JSON.stringify({ questionnaire: q }) });
      setPacket(d.packet || []);
      setSavedAt(d.questionnaire?.updatedAt || null);
      setNotice('Saved — your form packet below is ready to download.');
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const txt = (path, value, props = {}) => (
    <input type="text" value={value} onChange={(e) => set(path, e.target.value)} {...props} />
  );

  return (
    <div className={compact ? 'q-compact' : ''}>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <section className="card">
        <h3 className="card-title">Start here</h3>

        <label className="q-check q-accept">
          <input
            type="checkbox"
            checked={q.triage.accepted}
            onChange={(e) => set('triage.accepted', e.target.checked)}
          />
          <span><strong>{TRIAGE_STATEMENT}</strong> — I understand and accept.</span>
        </label>

        <div className="q-grid" style={{ marginBottom: 14 }}>
          <Field label="What state is the laboratory located in?" wide>
            <select value={q.lab.state} onChange={(e) => set('lab.state', e.target.value)}>
              <option value="">Select a state…</option>
              {SELECTABLE_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s] || s}</option>)}
            </select>
          </Field>
        </div>

        <h4 className="q-subhead">What state(s) will the laboratory receive patients from?</h4>
        <p className="muted small">Check as many as apply. Each state gets the federal CLIA forms (CMS-116 / CMS-209) filled out; states with their own application forms (currently California and Texas) get those added on top — and the packet adjusts to your lab's location (e.g. a lab outside California serving CA patients uses the out-of-state forms).</p>
        <div className="q-state-checks">
          {SELECTABLE_STATES.map((code) => (
            <label key={code} className={`q-state-check ${q.targetStates.includes(code) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={q.targetStates.includes(code)}
                onChange={() => toggleTargetState(code)}
              />
              <span>{STATE_NAMES[code] || code}</span>
              {STATES_WITH_SPECIFIC_FORMS.includes(code) && <span className="q-state-note">+ state forms</span>}
            </label>
          ))}
        </div>
        <p className="muted small q-ny-disclaimer">{NY_DISCLAIMER}</p>

        <h4 className="q-subhead">What is the highest complexity of assay being performed?</h4>
        <div className="q-states">
          {COMPLEXITY_LEVELS.map((c) => (
            <label key={c} className={`q-state-pill ${q.triage.complexity === c ? 'on' : ''}`}>
              <input type="radio" checked={q.triage.complexity === c} onChange={() => set('triage.complexity', c)} />
              {c}
            </label>
          ))}
        </div>

        <h4 className="q-subhead">What are we filing?</h4>
        {TRIAGE_QUESTIONS.map((tq) => (
          <div className="q-triage-row" key={tq.id}>
            <span className="q-triage-text">{tq.text}</span>
            <span className="q-triage-buttons">
              {['yes', 'no'].map((v) => (
                <button
                  key={v} type="button"
                  className={`answer-button ${q.triage.answers[tq.id] === v ? 'selected' : ''}`}
                  onClick={() => setTriageAnswer(tq.id, v)}
                >
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </span>
          </div>
        ))}
        <label className="q-field q-wide" style={{ marginTop: 10 }}>
          <span className="q-label">Please fill out all paperwork to the best of your ability and write a detailed message here:</span>
          <textarea
            rows={3}
            value={q.triage.message}
            onChange={(e) => set('triage.message', e.target.value)}
            placeholder="Anything we should know — what's changing, special circumstances, timing…"
          />
        </label>
        {triageType && (
          <p className="q-triage-result">→ {APPLICATION_TYPE_LABELS[triageType]}</p>
        )}
      </section>

      {!triageDone && (
        <section className="card">
          <p className="muted">Answer everything in "Start here" (accept the statement, pick your states and complexity, and answer the yes/no questions) — the rest of the questionnaire opens up from there.</p>
        </section>
      )}

      {triageDone && (<>
      <section className="card">
        <h3 className="card-title">Laboratory</h3>
        <div className="q-grid">
          <Field label="Legal name" wide>{txt('lab.name', q.lab.name)}</Field>
          <Field label="DBA (doing business as)">{txt('lab.dba', q.lab.dba)}</Field>
          <Field label="Ownership type">
            <select value={q.ownership.type} onChange={(e) => set('ownership.type', e.target.value)}>
              <option value="">Select…</option>
              {OWNERSHIP_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {q.ownership.type === 'other' && (
            <Field label="Ownership — describe">{txt('ownership.otherText', q.ownership.otherText)}</Field>
          )}
          <Field label="Street address" wide>{txt('lab.address', q.lab.address)}</Field>
          <Field label="Suite / room">{txt('lab.suite', q.lab.suite)}</Field>
          <Field label="City">{txt('lab.city', q.lab.city)}</Field>
          <Field label="State (from question above)">
            <input type="text" value={q.lab.state} readOnly disabled />
          </Field>
          <Field label="ZIP">{txt('lab.zip', q.lab.zip)}</Field>
          {q.targetStates.includes('TX') && (
            <Field label="County (Texas)">{txt('lab.county', q.lab.county)}</Field>
          )}
          <Field label="Phone">{txt('lab.phone', q.lab.phone)}</Field>
          <Field label="Fax">{txt('lab.fax', q.lab.fax)}</Field>
          <Field label="Email">{txt('lab.email', q.lab.email)}</Field>
          <Field label="Effective / anticipated start date">
            <input type="date" value={q.lab.effectiveDate} onChange={(e) => set('lab.effectiveDate', e.target.value)} />
          </Field>
          <Field label="EIN / Federal Tax ID">{txt('lab.ein', q.lab.ein)}</Field>
          <Field label="Estimated annual test volume">{txt('lab.testVolume', q.lab.testVolume)}</Field>
        </div>
        <h4 className="q-subhead">Hours of operation</h4>
        <div className="q-hours">
          {DAYS.map((d) => (
            <div className="q-hours-day" key={d.key}>
              <span className="q-label">{d.label}</span>
              <input type="text" placeholder="From" value={q.lab.hours[d.key]?.from || ''}
                onChange={(e) => set(`lab.hours.${d.key}`, { ...(q.lab.hours[d.key] || {}), from: e.target.value })} />
              <input type="text" placeholder="To" value={q.lab.hours[d.key]?.to || ''}
                onChange={(e) => set(`lab.hours.${d.key}`, { ...(q.lab.hours[d.key] || {}), to: e.target.value })} />
            </div>
          ))}
        </div>
        <h4 className="q-subhead">Mailing address</h4>
        <label className="q-check">
          <input type="checkbox" checked={q.mailing.sameAsPhysical}
            onChange={(e) => set('mailing.sameAsPhysical', e.target.checked)} />
          Same as physical address
        </label>
        {!q.mailing.sameAsPhysical && (
          <div className="q-grid">
            <Field label="Street address" wide>{txt('mailing.address', q.mailing.address)}</Field>
            <Field label="Suite / room">{txt('mailing.suite', q.mailing.suite)}</Field>
            <Field label="City">{txt('mailing.city', q.mailing.city)}</Field>
            <Field label="State">
              <select value={q.mailing.state} onChange={(e) => set('mailing.state', e.target.value)}>
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ZIP">{txt('mailing.zip', q.mailing.zip)}</Field>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">Licenses &amp; certificates</h3>
        <div className="q-grid">
          <Field label="CLIA number">{txt('license.cliaNumber', q.license.cliaNumber)}</Field>
          <Field label="CLIA expiration">
            <input type="date" value={q.license.cliaExpiration} onChange={(e) => set('license.cliaExpiration', e.target.value)} />
          </Field>
          <Field label="CLIA certificate type" wide>
            <select value={q.license.certificateType} onChange={(e) => set('license.certificateType', e.target.value)}>
              <option value="">Select…</option>
              {CERTIFICATE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          {q.license.certificateType === 'accreditation' && (
            <>
              <Field label="Accrediting organization">
                <select value={q.license.accreditingOrg} onChange={(e) => set('license.accreditingOrg', e.target.value)}>
                  <option value="">Select…</option>
                  {ACCREDITING_ORGS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              {q.license.accreditingOrg === 'COLA' && (
                <Field label="COLA number">{txt('license.colaNumber', q.license.colaNumber)}</Field>
              )}
            </>
          )}
          {q.targetStates.includes('CA') && (
            <>
              <Field label="CA state lab ID (if issued)">{txt('license.caStateId', q.license.caStateId)}</Field>
              <Field label="CA license expiration">
                <input type="date" value={q.license.caExpiration} onChange={(e) => set('license.caExpiration', e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Owners</h3>
        <p className="muted">List each owner (individual or company) and their share.</p>
        {q.owners.map((o, i) => (
          <div className="q-row-block" key={i}>
            <div className="q-grid">
              <Field label={`Owner ${i + 1} — name`} wide>
                <input type="text" value={o.name} onChange={(e) => setRow('owners', i, 'name', e.target.value)} />
              </Field>
              <Field label="Title"><input type="text" value={o.title || ''} onChange={(e) => setRow('owners', i, 'title', e.target.value)} /></Field>
              <Field label="Tax ID / SSN"><input type="text" value={o.taxId} onChange={(e) => setRow('owners', i, 'taxId', e.target.value)} /></Field>
              <Field label="% owned"><input type="text" value={o.percent} onChange={(e) => setRow('owners', i, 'percent', e.target.value)} /></Field>
              <Field label="Street address" wide><input type="text" value={o.address} onChange={(e) => setRow('owners', i, 'address', e.target.value)} /></Field>
              <Field label="City"><input type="text" value={o.city} onChange={(e) => setRow('owners', i, 'city', e.target.value)} /></Field>
              <Field label="State">
                <select value={o.state} onChange={(e) => setRow('owners', i, 'state', e.target.value)}>
                  <option value="">—</option>
                  {US_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP"><input type="text" value={o.zip} onChange={(e) => setRow('owners', i, 'zip', e.target.value)} /></Field>
              <Field label="Phone"><input type="text" value={o.phone} onChange={(e) => setRow('owners', i, 'phone', e.target.value)} /></Field>
            </div>
            {q.owners.length > 1 && (
              <button type="button" className="link-button danger small" onClick={() => removeRow('owners', i)}>Remove owner</button>
            )}
          </div>
        ))}
        {q.owners.length < 5 && (
          <button type="button" className="link-button" onClick={() => addRow('owners', { name: '', taxId: '', percent: '', address: '', city: '', state: '', zip: '', phone: '', title: '' })}>
            + Add owner
          </button>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">Laboratory director</h3>
        <div className="q-grid">
          <Field label="First name">{txt('director.firstName', q.director.firstName)}</Field>
          <Field label="Middle initial">{txt('director.middleInitial', q.director.middleInitial, { maxLength: 2 })}</Field>
          <Field label="Last name">{txt('director.lastName', q.director.lastName)}</Field>
          <Field label="Titles (MD, PhD…)">{txt('director.titles', q.director.titles)}</Field>
          <Field label="License type">
            <select value={q.director.licenseType} onChange={(e) => set('director.licenseType', e.target.value)}>
              <option value="">Select…</option>
              {DIRECTOR_LICENSE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="License number">{txt('director.licenseNumber', q.director.licenseNumber)}</Field>
          <Field label="License expiration">
            <input type="date" value={q.director.licenseExpiration} onChange={(e) => set('director.licenseExpiration', e.target.value)} />
          </Field>
          <Field label="Issuing board / agency">{txt('director.licenseIssuer', q.director.licenseIssuer)}</Field>
          <Field label="Phone">{txt('director.phone', q.director.phone)}</Field>
          <Field label="Email">{txt('director.email', q.director.email)}</Field>
          <Field label="Street address" wide>{txt('director.address', q.director.address)}</Field>
          <Field label="City">{txt('director.city', q.director.city)}</Field>
          <Field label="State">
            <select value={q.director.state} onChange={(e) => set('director.state', e.target.value)}>
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="ZIP">{txt('director.zip', q.director.zip)}</Field>
          <Field label="Association date (started with lab)">
            <input type="date" value={q.director.associationDate} onChange={(e) => set('director.associationDate', e.target.value)} />
          </Field>
          <Field label="Hours per week on site">{txt('director.hoursPerWeek', q.director.hoursPerWeek)}</Field>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Primary contact</h3>
        <div className="q-grid">
          <Field label="Name">{txt('contact.name', q.contact.name)}</Field>
          <Field label="Phone">{txt('contact.phone', q.contact.phone)}</Field>
          <Field label="Email">{txt('contact.email', q.contact.email)}</Field>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Testing personnel</h3>
        <p className="muted">Supervisors and testing staff (GS / TS / TC / TP) with their licenses.</p>
        {q.personnel.map((p, i) => (
          <div className="q-person-row" key={i}>
            <input type="text" placeholder="First" value={p.firstName} onChange={(e) => setRow('personnel', i, 'firstName', e.target.value)} />
            <input type="text" placeholder="MI" maxLength={2} className="q-mi" value={p.middleInitial} onChange={(e) => setRow('personnel', i, 'middleInitial', e.target.value)} />
            <input type="text" placeholder="Last" value={p.lastName} onChange={(e) => setRow('personnel', i, 'lastName', e.target.value)} />
            <span className="q-role-checks">
              {PERSONNEL_ROLES.map((r) => (
                <label key={r.value} className={personRoles(p).includes(r.value) ? 'on' : ''} title={r.label}>
                  <input
                    type="checkbox"
                    checked={personRoles(p).includes(r.value)}
                    onChange={() => togglePersonRole(i, r.value)}
                  />
                  {r.value}
                </label>
              ))}
            </span>
            <input type="text" placeholder="License type" value={p.licenseType} onChange={(e) => setRow('personnel', i, 'licenseType', e.target.value)} />
            <input type="text" placeholder="License #" value={p.licenseNumber} onChange={(e) => setRow('personnel', i, 'licenseNumber', e.target.value)} />
            {(personRoles(p).includes('TS') || personRoles(p).includes('TC')) && (
              <input
                type="text" className="q-specialty" placeholder="TS/TC specialty #s (e.g. 1, 3, 5)"
                title="Specialty/subspecialty numbers for the TS and TC columns on CMS-209"
                value={p.specialtyCodes || ''}
                onChange={(e) => setRow('personnel', i, 'specialtyCodes', e.target.value)}
              />
            )}
            <button type="button" className="link-button danger small" onClick={() => removeRow('personnel', i)}>×</button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={() => addRow('personnel', { firstName: '', middleInitial: '', lastName: '', roles: ['TP'], licenseType: '', licenseNumber: '' })}>
          + Add person
        </button>
        <p className="muted small">Roles (check all that a person holds): GS = General Supervisor · TS = Technical Supervisor · TC = Technical Consultant · TP = Testing Personnel</p>
      </section>

      {q.targetStates.includes('CA') && q.lab.state === 'CA' && (
        <section className="card">
          <h3 className="card-title">Lab assistants (California)</h3>
          <p className="muted">Non-testing staff and their schedules — goes on the CA personnel report.</p>
          {q.assistants.map((a, i) => (
            <div className="q-person-row q-assistant-row" key={i}>
              <input type="text" placeholder="Name" value={a.name} onChange={(e) => setRow('assistants', i, 'name', e.target.value)} />
              <input type="text" placeholder="Schedule (e.g. M–F 8am–5pm)" value={a.schedule} onChange={(e) => setRow('assistants', i, 'schedule', e.target.value)} />
              <input type="text" placeholder="Function" value={a.function || ''} onChange={(e) => setRow('assistants', i, 'function', e.target.value)} />
              <button type="button" className="link-button danger small" onClick={() => removeRow('assistants', i)}>×</button>
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => addRow('assistants', { name: '', schedule: '', function: '' })}>
            + Add lab assistant
          </button>
        </section>
      )}

      <section className="card">
        <h3 className="card-title">Associated laboratories</h3>
        <p className="muted">Other labs under common ownership or direction (CLIA multiple-site section).</p>
        {q.associatedLabs.map((l, i) => (
          <div className="q-person-row q-assoc-row" key={i}>
            <input type="text" placeholder="CLIA number" value={l.cliaNumber} onChange={(e) => setRow('associatedLabs', i, 'cliaNumber', e.target.value)} />
            <input type="text" placeholder="Laboratory name" value={l.name} onChange={(e) => setRow('associatedLabs', i, 'name', e.target.value)} />
            <button type="button" className="link-button danger small" onClick={() => removeRow('associatedLabs', i)}>×</button>
          </div>
        ))}
        {q.associatedLabs.length < 6 && (
          <button type="button" className="link-button" onClick={() => addRow('associatedLabs', { cliaNumber: '', name: '' })}>
            + Add associated lab
          </button>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">Form prepared by</h3>
        <div className="q-grid">
          <Field label="Name">{txt('preparedBy.name', q.preparedBy.name)}</Field>
          <Field label="Title">{txt('preparedBy.title', q.preparedBy.title)}</Field>
        </div>
      </section>
      </>)}

      <div className="save-bar">
        <span className="muted small">{savedAt && `Saved ${new Date(savedAt).toLocaleString()}`}</span>
        <button className="submit-button save-button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save questionnaire'}
        </button>
      </div>

      <section className="card">
        <h3 className="card-title">Your form packet</h3>
        {packet.length === 0 && <p className="muted">Save the questionnaire to see which forms apply.</p>}
        {packet.map((grp) => (
          <div key={grp.group} className="q-packet-group">
            <h4 className="q-subhead">{grp.name}</h4>
            {grp.note && <p className="muted small">{grp.note}</p>}
            {grp.forms.map((f) => (
              <div className="doc-row" key={f.id}>
                <div className="doc-info">
                  <span className="doc-name">{f.title}</span>
                  {f.stage !== 'initial' && <span className="doc-meta">{f.stage === 'renewal' ? 'Renewal — use when renewing an existing license' : 'Use when reporting changes to an existing license'}</span>}
                  {f.adobeOnly && <span className="doc-meta">Dynamic government form — open the downloaded file in Adobe Reader/Acrobat to see your pre-filled data.</span>}
                </div>
                <a className="link-button" href={`${formDownloadPath}/${f.id}/download`}>Download pre-filled</a>
              </div>
            ))}
          </div>
        ))}
        <p className="muted small">Forms are pre-filled from this questionnaire. Review every form, complete test-menu and signature sections by hand, then sign and submit.</p>
      </section>
    </div>
  );
}
