import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';

const FEATURES = [
  {
    icon: '📋',
    title: 'Readiness Assessment',
    text: 'Answer a guided questionnaire across six compliance areas — CLIA regulatory, personnel, SOPs, equipment, quality control, and safety — and get an instant readiness score with a category-by-category breakdown.',
  },
  {
    icon: '🤖',
    title: 'AI Document Analysis',
    text: 'Upload your certificates, SOPs, calibration records, and safety plans. Each document is automatically identified, dated, and checked — expired, unsigned, or problematic documents are flagged on the spot.',
  },
  {
    icon: '✅',
    title: 'Compliance Gap Tracking',
    text: 'A living checklist of 17 required documents shows exactly what you have, what has expired, and what is still missing — so nothing surprises you on inspection day.',
  },
  {
    icon: '🧭',
    title: 'Expert Guidance',
    text: 'Built by Prescher Lab Consulting from real inspection experience. Your progress is visible to your consultant, who can review your documents and guide you to inspection-ready.',
  },
];

const STEPS = [
  { n: '1', title: 'Create your account', text: 'Register your laboratory in under two minutes.' },
  { n: '2', title: 'Take the assessment', text: 'See your readiness score and where you stand.' },
  { n: '3', title: 'Upload your documents', text: 'AI checks each one and builds your gap list.' },
  { n: '4', title: 'Close the gaps', text: 'Work the checklist until you are inspection-ready.' },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-logo">🧪</span>
          <span>Lab Readiness Portal</span>
        </div>
        <nav className="landing-nav-right">
          {user ? (
            <Link className="nav-cta" to={user.role === 'admin' ? '/admin' : '/dashboard'}>Go to Dashboard</Link>
          ) : (
            <>
              <Link className="nav-link" to="/login">Sign In</Link>
              <Link className="nav-cta" to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero">
        <h1>From empty facility to inspection-ready in 90 days</h1>
        <p className="hero-sub">
          The Lab Readiness Portal walks your laboratory through CLIA and OSHA compliance step by step —
          assess where you stand, upload your documentation, and close every gap before the inspector arrives.
        </p>
        <div className="hero-actions">
          <Link className="hero-cta" to="/register">Register Now</Link>
          <span className="hero-note">Free to get started · No credit card required</span>
        </div>
      </section>

      <section className="landing-section">
        <h2>Everything your lab needs to get inspection-ready</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-steps">
        <h2>How it works</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step-card" key={s.n}>
              <span className="step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-coverage">
        <h2>Built around the standards that matter</h2>
        <p className="coverage-sub">
          Requirements and document checklists are organized around the regulations laboratories are
          actually inspected against.
        </p>
        <div className="coverage-badges">
          <span className="coverage-badge">CLIA</span>
          <span className="coverage-badge">OSHA</span>
          <span className="coverage-badge">CDC Guidelines</span>
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Ready to see where your lab stands?</h2>
        <Link className="hero-cta" to="/register">Register Now</Link>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Prescher Lab Consulting · Lab Readiness Portal</span>
        <span><Link to="/login">Sign In</Link> · <Link to="/register">Register</Link></span>
      </footer>
    </div>
  );
}
