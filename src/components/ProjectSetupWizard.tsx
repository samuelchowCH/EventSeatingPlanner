/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectSetupWizard — 6-step guided event creation wizard.
 *
 * Steps:
 *  1. Basics        — Event name + type
 *  2. Date & Venue  — Date, venue name, city
 *  3. Background    — Description, guest count, dietary notes
 *  4. Visual Prefs  — Arena mode (+ optional AI theme suggestions)
 *  5. Seating       — Table shape + seats per table
 *  6. Review        — Summary + Create / Save Draft
 *
 * AI suggestions (Step 4):
 *  - Calls POST /api/gemini/setup
 *  - Only populates fields the user has NOT yet confirmed
 *  - Full graceful fallback on network / API failure
 *
 * Draft persistence:
 *  - Key: seating_planner_wizard_draft
 *  - Loaded on mount; cleared on successful Create
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EventType, EventMetadata } from '../types';
import {
  ChevronRight, ChevronLeft, Check, Sparkles, Save,
  AlertCircle, Info, Loader2, X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardFormData {
  // Step 1
  name: string;
  eventType: EventType | '';
  // Step 2
  date: string;
  venueName: string;
  venueCity: string;
  // Step 3
  description: string;
  guestCountEstimated: string; // string for controlled input
  dietaryNotes: string;
  // Step 4
  arenaMode: 'dining' | 'lecture';
  // Step 5
  defaultTableShape: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom';
  defaultTableSeats: string; // string for controlled input
  // AI suggestion state
  aiThemeName: string;
  aiFillColor: string;
  aiStrokeColor: string;
  aiStrokeWidth: number;
  aiBackgroundColor: string;
  aiGridOpacity: number;
  aiSetupNotes: string;
  aiApplied: boolean;
}

interface AiSetupRecommendation {
  themeName: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  gridOpacity: number;
  defaultTableShape: string;
  defaultTableSeats: number;
  arenaMode: string;
  setupNotes: string;
}

export interface ProjectSetupWizardProps {
  onCreateEvent: (
    name: string,
    date: string | undefined,
    metadata: EventMetadata,
    defaultTableShape: WizardFormData['defaultTableShape'],
    defaultTableSeats: number,
    arenaMode: 'dining' | 'lecture',
    aiTheme?: {
      fillColor: string;
      strokeColor: string;
      strokeWidth: number;
      backgroundColor: string;
      gridOpacity: number;
      name: string;
    }
  ) => void;
  onCancel?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'seating_planner_wizard_draft';
const TOTAL_STEPS = 6;

const EVENT_TYPES: EventType[] = ['Wedding', 'Seminar', 'Birthday', 'Corporate', 'Other'];

const TABLE_SHAPES: Array<{ value: WizardFormData['defaultTableShape']; label: string; icon: string }> = [
  { value: 'round',     label: 'Round',    icon: '⬤' },
  { value: 'rectangle', label: 'Rectangle', icon: '▬' },
  { value: 'square',    label: 'Square',   icon: '■' },
  { value: 'banquet',   label: 'Banquet',  icon: '▭' },
  { value: 'banana',    label: 'Banana',   icon: '⌒' },
  { value: 'nano',      label: 'Nano',     icon: '◦' },
];

const STEP_LABELS = [
  'Basics',
  'Date & Venue',
  'Background',
  'Visual Prefs',
  'Seating',
  'Review',
];

const DEFAULT_FORM: WizardFormData = {
  name: '',
  eventType: '',
  date: '',
  venueName: '',
  venueCity: '',
  description: '',
  guestCountEstimated: '',
  dietaryNotes: '',
  arenaMode: 'dining',
  defaultTableShape: 'round',
  defaultTableSeats: '8',
  aiThemeName: '',
  aiFillColor: '',
  aiStrokeColor: '',
  aiStrokeWidth: 3,
  aiBackgroundColor: '',
  aiGridOpacity: 0.12,
  aiSetupNotes: '',
  aiApplied: false,
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: number, form: WizardFormData): string[] {
  const errors: string[] = [];
  switch (step) {
    case 1:
      if (!form.name.trim()) errors.push('Event name is required.');
      if (!form.eventType) errors.push('Please select an event type.');
      break;
    case 3: {
      const count = Number(form.guestCountEstimated);
      if (form.guestCountEstimated && (isNaN(count) || count < 1)) {
        errors.push('Estimated guest count must be a positive number.');
      }
      break;
    }
    case 5: {
      const seats = Number(form.defaultTableSeats);
      if (isNaN(seats) || seats < 2 || seats > 30) {
        errors.push('Seats per table must be between 2 and 30.');
      }
      break;
    }
  }
  return errors;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colours = {
    success: 'bg-emerald-950/95 border-emerald-500 text-emerald-100',
    error:   'bg-red-950/95 border-red-500 text-red-100',
    info:    'bg-gilded-ink border-gilded-accent text-gilded-bg',
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-none border shadow-2xl backdrop-blur-md text-xs font-mono max-w-sm animate-slide-up ${colours[type]}`}
    >
      {type === 'success' && <Check size={16} className="shrink-0" />}
      {type === 'error'   && <AlertCircle size={16} className="shrink-0" />}
      {type === 'info'    && <Info size={16} className="shrink-0" />}
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center justify-center gap-1 flex-wrap font-mono">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div
                aria-current={active ? 'step' : undefined}
                className={`w-8 h-8 rounded-none flex items-center justify-center text-xs font-bold border transition-all duration-300
                  ${done   ? 'bg-emerald-700 border-emerald-500 text-white' : ''}
                  ${active ? 'bg-gilded-accent border-gilded-accent text-gilded-ink font-extrabold shadow-sm' : ''}
                  ${!done && !active ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}`}
              >
                {done ? <Check size={12} /> : step}
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider hidden sm:block ${active ? 'text-gilded-ink' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
                {labels[i]}
              </span>
            </div>
            {step < total && (
              <div className={`h-0.5 w-5 sm:w-8 mb-4 transition-all duration-300 ${done ? 'bg-emerald-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─── Field Components ─────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-gilded-ink font-mono uppercase tracking-wider">
        {label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 font-mono">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 font-bold flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls = `w-full bg-white border border-gray-300 rounded-none px-3 py-2 text-xs font-sans text-gilded-ink
  placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gilded-accent focus:border-gilded-accent
  transition-all duration-150`;

const textareaCls = `${inputCls} resize-none`;

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({ form, onChange, errors }: { form: WizardFormData; onChange: (k: keyof WizardFormData, v: any) => void; errors: string[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Event Basics</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">Give your event a name and select its operational category.</p>
      </div>
      <Field id="wizard-name" label="Event Name" required error={errors.find(e => e.includes('name'))}>
        <input
          id="wizard-name"
          type="text"
          className={inputCls}
          placeholder="e.g. Sarah & Tom's Wedding"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
          aria-required="true"
          aria-describedby={errors.find(e => e.includes('name')) ? 'wizard-name-error' : undefined}
          maxLength={100}
          autoFocus
        />
      </Field>
      <Field id="wizard-event-type" label="Event Type" required error={errors.find(e => e.includes('type'))}>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="radiogroup" aria-labelledby="wizard-event-type">
          {EVENT_TYPES.map(type => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={form.eventType === type}
              onClick={() => onChange('eventType', type)}
              className={`px-3 py-2.5 rounded-none text-xs font-bold font-serif border transition-all duration-150 cursor-pointer
                ${form.eventType === type
                  ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gilded-accent hover:text-gilded-ink'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step2({ form, onChange }: { form: WizardFormData; onChange: (k: keyof WizardFormData, v: any) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Date & Venue</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">All fields are optional — you can update these later.</p>
      </div>
      <Field id="wizard-date" label="Event Date" hint="Used for display and sorting only.">
        <input
          id="wizard-date"
          type="date"
          className={inputCls}
          value={form.date}
          onChange={e => onChange('date', e.target.value)}
        />
      </Field>
      <Field id="wizard-venue" label="Venue Name" hint="e.g. The Grand Ballroom, City Hall">
        <input
          id="wizard-venue"
          type="text"
          className={inputCls}
          placeholder="Venue name"
          value={form.venueName}
          onChange={e => onChange('venueName', e.target.value)}
          maxLength={100}
        />
      </Field>
      <Field id="wizard-city" label="City / Location">
        <input
          id="wizard-city"
          type="text"
          className={inputCls}
          placeholder="e.g. Singapore"
          value={form.venueCity}
          onChange={e => onChange('venueCity', e.target.value)}
          maxLength={100}
        />
      </Field>
    </div>
  );
}

function Step3({ form, onChange, errors }: { form: WizardFormData; onChange: (k: keyof WizardFormData, v: any) => void; errors: string[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Event Background</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">These details help the AI generate tailored visual recommendations.</p>
      </div>
      <Field id="wizard-desc" label="Event Description" hint="A few sentences about the event atmosphere, theme, or style.">
        <textarea
          id="wizard-desc"
          className={textareaCls}
          rows={3}
          placeholder="e.g. A romantic garden wedding with a floral theme and rustic wooden décor..."
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
          maxLength={500}
        />
      </Field>
      <Field id="wizard-guest-count" label="Estimated Guest Count" error={errors.find(e => e.includes('guest'))}>
        <input
          id="wizard-guest-count"
          type="number"
          className={inputCls}
          placeholder="e.g. 120"
          value={form.guestCountEstimated}
          onChange={e => onChange('guestCountEstimated', e.target.value)}
          min={1}
          max={5000}
          aria-describedby={errors.find(e => e.includes('guest')) ? 'wizard-guest-count-error' : undefined}
        />
      </Field>
      <Field id="wizard-dietary" label="Dietary / Special Notes" hint="e.g. 20% vegetarian, nut-free venue">
        <input
          id="wizard-dietary"
          type="text"
          className={inputCls}
          placeholder="Any dietary or accessibility requirements"
          value={form.dietaryNotes}
          onChange={e => onChange('dietaryNotes', e.target.value)}
          maxLength={200}
        />
      </Field>
    </div>
  );
}

interface Step4Props {
  form: WizardFormData;
  onChange: (k: keyof WizardFormData, v: any) => void;
  onRequestAI: () => void;
  aiLoading: boolean;
  aiError: string;
}

function Step4({ form, onChange, onRequestAI, aiLoading, aiError }: Step4Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Visual Preferences</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">Choose your venue layout mode. Optionally let AI suggest a color scheme.</p>
      </div>

      {/* Arena mode */}
      <Field id="wizard-arena" label="Venue Layout Mode">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['dining', 'lecture'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange('arenaMode', mode)}
              aria-pressed={form.arenaMode === mode}
              className={`flex flex-col items-center gap-2 p-4 rounded-none border transition-all duration-150 cursor-pointer
                ${form.arenaMode === mode
                  ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gilded-accent hover:text-gilded-ink'}`}
            >
              <span className="text-2xl">{mode === 'dining' ? '🍽️' : '🎓'}</span>
              <span className="text-xs font-serif font-bold uppercase tracking-wider">{mode === 'dining' ? 'Dining Banquet' : 'Lecture Seminar'}</span>
              <span className="text-[10px] text-center font-mono opacity-80">
                {mode === 'dining' ? 'Round tables & banquet configurations' : 'Podium-facing classroom rows'}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {/* AI recommendations */}
      <div className="rounded-none border border-gilded-accent/50 bg-gilded-faint p-4 space-y-3">
        <div className="flex items-center gap-2 text-gilded-ink text-xs font-bold font-serif uppercase tracking-wider">
          <Sparkles size={14} className="text-gilded-accent" />
          AI Theme Suggestions <span className="text-gray-400 font-normal font-mono lowercase">(optional)</span>
        </div>
        <p className="text-xs text-gray-600 font-mono leading-relaxed">
          Based on your event details, Gemini AI will recommend a color scheme and default layout setup.
        </p>

        {form.aiApplied && form.aiThemeName && (
          <div className="rounded-none bg-white border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-bold font-serif text-emerald-800 flex items-center gap-1">
              <Check size={13} /> Theme applied: <span className="text-gilded-ink font-bold ml-1">{form.aiThemeName}</span>
            </p>
            <p className="text-xs text-gray-500 font-mono italic">{form.aiSetupNotes}</p>
            <div className="flex gap-3 mt-1 flex-wrap">
              {[form.aiFillColor, form.aiStrokeColor, form.aiBackgroundColor].map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-none border border-gray-300 shadow-3xs" style={{ background: c }} />
                  <span className="text-xs text-gray-700 font-mono font-bold">{c}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange('aiApplied', false);
                onChange('aiThemeName', '');
              }}
              className="text-xs text-red-600 hover:underline font-mono font-bold cursor-pointer pt-1"
            >
              Remove theme
            </button>
          </div>
        )}

        {aiError && (
          <p role="alert" aria-live="assertive" className="text-xs text-red-600 font-bold flex items-center gap-1 font-mono">
            <AlertCircle size={13} /> {aiError}
          </p>
        )}

        <button
          type="button"
          onClick={onRequestAI}
          disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-none bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-bold font-sans uppercase tracking-wider
            disabled:opacity-50 disabled:cursor-not-allowed border border-gilded-border transition-all cursor-pointer shadow-3xs"
        >
          {aiLoading
            ? <><Loader2 size={14} className="animate-spin" /> Getting suggestions…</>
            : <><Sparkles size={14} /> {form.aiApplied ? 'Refresh AI suggestions' : 'Get AI suggestions'}</>
          }
        </button>
      </div>
    </div>
  );
}

function Step5({ form, onChange, errors }: { form: WizardFormData; onChange: (k: keyof WizardFormData, v: any) => void; errors: string[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Seating Defaults</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">These are initial defaults — you can customize tables individually later.</p>
      </div>
      <Field id="wizard-table-shape" label="Default Table Shape">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TABLE_SHAPES.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.defaultTableShape === value}
              onClick={() => onChange('defaultTableShape', value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-none border text-xs font-serif font-bold transition-all duration-150 cursor-pointer
                ${form.defaultTableShape === value
                  ? 'bg-gilded-ink border-gilded-ink text-gilded-accent shadow-xs'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gilded-accent hover:text-gilded-ink'}`}
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field id="wizard-seats" label="Seats per Table" required error={errors.find(e => e.includes('Seats'))}>
        <div className="flex items-center gap-3">
          <input
            id="wizard-seats"
            type="range"
            min={2} max={30}
            value={Number(form.defaultTableSeats) || 8}
            onChange={e => onChange('defaultTableSeats', e.target.value)}
            className="flex-1 accent-gilded-accent cursor-pointer"
          />
          <input
            type="number"
            value={form.defaultTableSeats}
            onChange={e => onChange('defaultTableSeats', e.target.value)}
            min={2} max={30}
            aria-label="Seats per table number"
            aria-describedby={errors.find(e => e.includes('Seats')) ? 'wizard-seats-error' : undefined}
            className={`${inputCls} w-20 text-center font-mono font-bold`}
          />
        </div>
        <p className="text-xs text-gray-500 font-mono">Range: 2 – 30 seats</p>
      </Field>
    </div>
  );
}

function Step6Review({ form }: { form: WizardFormData }) {
  const rows: Array<[string, string]> = [
    ['Event Name', form.name || '—'],
    ['Event Type', form.eventType || '—'],
    ['Date', form.date || '—'],
    ['Venue', [form.venueName, form.venueCity].filter(Boolean).join(', ') || '—'],
    ['Guest Count', form.guestCountEstimated || '—'],
    ['Dietary Notes', form.dietaryNotes || '—'],
    ['Layout Mode', form.arenaMode === 'dining' ? 'Dining (Round tables)' : 'Lecture (Rows)'],
    ['Table Shape', TABLE_SHAPES.find(s => s.value === form.defaultTableShape)?.label || form.defaultTableShape],
    ['Seats per Table', form.defaultTableSeats],
    ['AI Theme', form.aiApplied && form.aiThemeName ? form.aiThemeName : 'None'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gilded-ink font-serif">Review & Create</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">Review your event specifications before initializing the seating workspace.</p>
      </div>
      <div className="rounded-none border border-gray-200 overflow-hidden bg-white">
        <table className="w-full text-xs font-sans">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 px-4 text-gray-500 font-mono uppercase tracking-wider font-bold w-40 bg-slate-50/50">{label}</td>
                <td className="py-2.5 px-4 text-gilded-ink font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form.description && (
        <div className="rounded-none bg-slate-50 border border-gray-200 p-3 space-y-1">
          <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">Description</p>
          <p className="text-xs text-gray-700 leading-relaxed font-sans">{form.description}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ProjectSetupWizard({ onCreateEvent, onCancel }: ProjectSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  /** Track which fields the user has explicitly modified (for AI override protection) */
  const userTouched = useRef<Set<keyof WizardFormData>>(new Set());

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft: WizardFormData = JSON.parse(saved);
        setForm(draft);
        showToast('Draft loaded — pick up where you left off.', 'info');
      }
    } catch {
      // Corrupt draft — ignore
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  const handleChange = useCallback((key: keyof WizardFormData, value: any) => {
    userTouched.current.add(key);
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => prev.filter(e => !e.toLowerCase().includes(key.toLowerCase())));
  }, []);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      showToast('Draft saved! You can come back any time.', 'success');
    } catch {
      showToast('Could not save draft — storage may be full.', 'error');
    }
  }, [form, showToast]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // ── AI request ──────────────────────────────────────────────────────────────
  const handleRequestAI = useCallback(async () => {
    setAiLoading(true);
    setAiError('');

    // Snapshot form before async call — protects user data if UI is interactive
    const snapshot = { ...form };

    try {
      const res = await fetch('/api/gemini/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: snapshot.name,
          eventType: snapshot.eventType,
          description: snapshot.description,
          venueName: snapshot.venueName,
          guestCount: snapshot.guestCountEstimated,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data: AiSetupRecommendation = await res.json();

      setForm(prev => {
        const updated = { ...prev };
        // Always update AI-specific fields
        updated.aiThemeName = data.themeName;
        updated.aiFillColor = data.fillColor;
        updated.aiStrokeColor = data.strokeColor;
        updated.aiStrokeWidth = data.strokeWidth;
        updated.aiBackgroundColor = data.backgroundColor;
        updated.aiGridOpacity = data.gridOpacity;
        updated.aiSetupNotes = data.setupNotes;
        updated.aiApplied = true;

        // Only overwrite seating defaults if user hasn't touched them
        if (!userTouched.current.has('defaultTableShape') && data.defaultTableShape) {
          updated.defaultTableShape = data.defaultTableShape as WizardFormData['defaultTableShape'];
        }
        if (!userTouched.current.has('defaultTableSeats') && data.defaultTableSeats) {
          updated.defaultTableSeats = String(data.defaultTableSeats);
        }
        if (!userTouched.current.has('arenaMode') && data.arenaMode) {
          updated.arenaMode = (data.arenaMode === 'lecture' ? 'lecture' : 'dining') as 'dining' | 'lecture';
        }

        return updated;
      });

      showToast(`AI theme "${data.themeName}" applied!`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'AI suggestions unavailable. You can still create your event manually.';
      setAiError(msg);
      showToast(msg, 'error');
    } finally {
      setAiLoading(false);
    }
  }, [form, showToast]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = () => {
    const errs = validateStep(step, form);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setErrors([]);
    setStep(s => Math.max(s - 1, 1));
  };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const errs = validateStep(step, form);
    if (errs.length > 0) { setErrors(errs); return; }

    setIsCreating(true);

    const metadata: EventMetadata = {
      eventType: form.eventType as EventType || undefined,
      description: form.description || undefined,
      venueName: form.venueName || undefined,
      venueCity: form.venueCity || undefined,
      guestCountEstimated: form.guestCountEstimated ? Number(form.guestCountEstimated) : undefined,
      dietaryNotes: form.dietaryNotes || undefined,
    };

    const aiTheme = form.aiApplied && form.aiThemeName
      ? {
          fillColor: form.aiFillColor,
          strokeColor: form.aiStrokeColor,
          strokeWidth: form.aiStrokeWidth,
          backgroundColor: form.aiBackgroundColor,
          gridOpacity: form.aiGridOpacity,
          name: form.aiThemeName,
        }
      : undefined;

    onCreateEvent(
      form.name.trim(),
      form.date || undefined,
      metadata,
      form.defaultTableShape,
      Math.min(Math.max(Number(form.defaultTableSeats) || 8, 2), 30),
      form.arenaMode,
      aiTheme,
    );

    clearDraft();
    setIsCreating(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gilded-bg flex items-start justify-center py-6 sm:py-10 px-4">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gilded-ink font-serif tracking-tight">New Event Setup</h1>
          <p className="text-xs text-gray-500 font-mono">Step {step} of {TOTAL_STEPS}</p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

        {/* Card */}
        <div className="bg-white border border-gilded-border rounded-none shadow-3xs p-6 sm:p-8">

          {/* Step validation error banner */}
          {errors.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 flex items-start gap-3 p-3 rounded-none bg-red-50 border border-red-200 text-red-700 text-xs font-mono"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <ul className="list-none space-y-0.5">
                {errors.map(e => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Active step */}
          {step === 1 && <Step1 form={form} onChange={handleChange} errors={errors} />}
          {step === 2 && <Step2 form={form} onChange={handleChange} />}
          {step === 3 && <Step3 form={form} onChange={handleChange} errors={errors} />}
          {step === 4 && (
            <Step4
              form={form}
              onChange={handleChange}
              onRequestAI={handleRequestAI}
              aiLoading={aiLoading}
              aiError={aiError}
            />
          )}
          {step === 5 && <Step5 form={form} onChange={handleChange} errors={errors} />}
          {step === 6 && <Step6Review form={form} />}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-2 rounded-none text-xs font-mono text-gray-500 hover:text-gilded-ink hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={saveDraft}
                className="flex items-center gap-1.5 px-3 py-2 rounded-none text-xs font-mono text-gray-500 hover:text-gilded-ink hover:bg-gray-100 transition-all cursor-pointer"
                title="Save current progress as draft"
              >
                <Save size={14} /> Save Draft
              </button>
            </div>

            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 px-4 py-2 rounded-none text-xs font-sans font-bold
                    text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1 px-5 py-2 rounded-none text-xs font-sans font-bold uppercase tracking-wider
                    bg-gilded-ink hover:bg-black text-gilded-accent shadow-3xs border border-gilded-border transition-all cursor-pointer"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-6 py-2 rounded-none text-xs font-sans font-bold uppercase tracking-wider
                    bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 disabled:cursor-not-allowed
                    text-white shadow-3xs transition-all cursor-pointer"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Create Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
