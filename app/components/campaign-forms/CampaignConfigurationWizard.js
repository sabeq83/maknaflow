'use client';

import { useRef } from 'react';
import './campaign-wizard.css';

/** Presentation only: the canonical form keeps its own state, controls and submit handler. */
export default function CampaignConfigurationWizard({ steps, step, onStepChange, children, busy, error, onCancel, label = 'Konfigurasi Campaign', submitLabel = 'Review Jadwal →' }) {
  const root = useRef(null);
  const move = next => {
    if (busy || next < 0 || next >= steps.length) return;
    const form = root.current?.querySelector('form');
    if (next > step && form && !form.reportValidity()) return;
    onStepChange(next);
  };
  const finish = () => {
    const form = root.current?.querySelector('form');
    if (form?.reportValidity()) form.requestSubmit();
  };
  return <div className="campaign-wizard">
    <aside className="campaign-wizard-steps" aria-label="Langkah konfigurasi">
      <strong>{label}</strong>
      {steps.map((title, index) => <button key={title} type="button" disabled={busy || index > step}
        aria-current={index === step ? 'step' : undefined} onClick={() => move(index)}>
        <span>{index + 1}</span>{title}
      </button>)}
      <small>Pengaturan yang sama dengan menu campaign asal.</small>
    </aside>
    <section className="campaign-wizard-panel">
      <div className="campaign-wizard-heading"><small>LANGKAH {step + 1} DARI {steps.length}</small><h3>{steps[step]}</h3></div>
      {error && <div className="campaign-wizard-error" role="alert">{error}</div>}
      <div ref={root} className="campaign-wizard-fields" onSubmitCapture={event => {
        if (step < steps.length - 1) { event.preventDefault(); event.stopPropagation(); move(step + 1); }
      }}>{children}</div>
      <div className="campaign-wizard-footer">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={step ? () => move(step - 1) : onCancel}>{step ? '← Kembali' : 'Batal'}</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={step === steps.length - 1 ? finish : () => move(step + 1)}>
          {busy ? 'Memproses…' : step === steps.length - 1 ? submitLabel : 'Lanjut →'}
        </button>
      </div>
      <p className="campaign-wizard-policy">Konfigurasi produksi mengikuti menu asal. Publikasi melalui Studio tetap menunggu review dan approval.</p>
    </section>
  </div>;
}
