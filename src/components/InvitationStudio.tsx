import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Download,
  XCircle,
  FileText,
  UserCheck,
  ShieldCheck,
  LogOut,
  CheckCircle,
  Users,
  CheckSquare,
  Square,
  Trash2,
  Shield,
  Eye,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Guest, Table } from '../types';
import { renderTextTemplate, renderHtmlFromText } from '../utils/emailRenderer';
import ImageCropModal from './ImageCropModal';
import TipTapBodyEditor from './TipTapBodyEditor';

interface InvitationStudioProps {
  activeEventId: string | null;
  activeEventName: string;
  guests: Guest[];
  tables: Table[];
}

export function InvitationStudio({ activeEventId, activeEventName, guests, tables }: InvitationStudioProps) {
  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Gmail Status State
  const [gmailConnected, setGmailConnected] = useState<boolean>(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  // Image & Preview States
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [previewGuestId, setPreviewGuestId] = useState<string | null>(null);
  const [lastInsertedImageHtml, setLastInsertedImageHtml] = useState<string | null>(null);

  // Template State
  const [subject, setSubject] = useState('You are cordially invited to {{event_name}}');
  const [bodyText, setBodyText] = useState(
    '<p>Dear {{guest_name}},</p><p>We are delighted to invite you to {{event_name}}!</p><p>Your reserved seating details:<br/>Table: {{table_name}}</p><p>Please let us know if you have any questions.</p><p>Warm regards,<br/>Event Host</p>'
  );
  const [replyTo, setReplyTo] = useState('');

  // Guest Selection State
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'seated' | 'unseated'>('all');

  // Staging & Sending State
  const [stagingLoading, setStagingLoading] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [stagedSummary, setStagedSummary] = useState<any | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);

  // Active Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initial Session & Gmail Status Check
  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (isAdminAuthenticated) {
      checkGmailStatus();
    }
  }, [isAdminAuthenticated]);

  // Handle URL Hash Messages (e.g. #gmail-connected?email=...)
  useEffect(() => {
    if (window.location.hash.includes('gmail-connected')) {
      showToast('Gmail account connected successfully!');
      checkGmailStatus();
    } else if (window.location.hash.includes('gmail-error')) {
      showToast('Failed to connect Gmail account. Please try again.');
    }
  }, []);

  // Sync selected guests when filter changes
  useEffect(() => {
    const initialSelected = new Set<string>();
    guests.forEach((g) => {
      if (g.email && g.email.trim() !== '') {
        if (filterMode === 'all') initialSelected.add(g.id);
        else if (filterMode === 'seated' && g.tableId !== null) initialSelected.add(g.id);
        else if (filterMode === 'unseated' && g.tableId === null) initialSelected.add(g.id);
      }
    });
    setSelectedGuestIds(initialSelected);
  }, [guests, filterMode]);

  // Poll active job status
  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/invitations/jobs/${activeJobId}/status`);
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
          if (data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'FAILED') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to fetch job status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const checkAdminSession = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/session');
      if (res.ok) {
        const data = await res.json();
        setIsAdminAuthenticated(Boolean(data.authenticated));
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const checkGmailStatus = async () => {
    setGmailLoading(true);
    try {
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        setGmailConnected(Boolean(data.connected));
        setGmailEmail(data.email || null);
      }
    } catch (err) {
      console.error('Gmail status check failed:', err);
    } finally {
      setGmailLoading(false);
    }
  };

  useEffect(() => {
    const handleSync = () => checkGmailStatus();
    window.addEventListener('gmail-status-changed', handleSync);
    window.addEventListener('hashchange', handleSync);
    return () => {
      window.removeEventListener('gmail-status-changed', handleSync);
      window.removeEventListener('hashchange', handleSync);
    };
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsAdminAuthenticated(true);
        setAdminPassword('');
        showToast('Admin authenticated successfully');
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err: any) {
      setAuthError('Connection error during login');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsAdminAuthenticated(false);
      showToast('Logged out');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleConnectGmail = () => {
    // Server-side redirect to Google OAuth start endpoint
    window.location.href = '/api/auth/google/start';
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect your Gmail account?')) return;
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setGmailConnected(false);
        setGmailEmail(null);
        window.dispatchEvent(new Event('gmail-status-changed'));
        showToast('Gmail account disconnected');
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedGuestIds.size > 0) {
      setSelectedGuestIds(new Set());
    } else {
      const allEligible = new Set<string>();
      guests.forEach((g) => {
        if (g.email && g.email.trim() !== '') allEligible.add(g.id);
      });
      setSelectedGuestIds(allEligible);
    }
  };

  const handleToggleGuest = (id: string) => {
    const updated = new Set(selectedGuestIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedGuestIds(updated);
  };

  const handleInsertImageToBodyText = (imgHtml: string) => {
    setLastInsertedImageHtml(imgHtml);
    showToast('Image inserted at cursor position!');
  };

  const eligibleGuests = guests.filter((g) => Boolean(g.email && g.email.trim() !== ''));
  const currentPreviewIndex = eligibleGuests.findIndex((g) => g.id === previewGuestId);
  const previewGuest = currentPreviewIndex !== -1 ? eligibleGuests[currentPreviewIndex] : null;

  const getTableAssignmentName = (guest: Guest): string => {
    if (!guest.tableId) return 'Unassigned';
    const table = tables.find((t) => t.id === guest.tableId);
    return table ? table.name : 'Unassigned';
  };

  const getGuestContext = (guest: Guest) => ({
    guest_name: guest.name,
    event_name: activeEventName || 'Sample Event',
    table_name: getTableAssignmentName(guest),
    unsubscribe_url: `${window.location.origin}/unsubscribe?t=preview_only`,
  });

  const handleSendTestToSelf = async () => {
    setTestSending(true);
    try {
      const res = await fetch('/api/invitations/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { subject, body_text: bodyText, reply_to: replyTo || undefined },
          event_name: activeEventName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Test email sent to ${data.recipient}!`);
      } else {
        alert(`Test email failed: ${data.error}`);
      }
    } catch (err: any) {
      alert('Test send error: ' + err.message);
    } finally {
      setTestSending(false);
    }
  };

  const handleStageBatch = async () => {
    setStagingLoading(true);
    setStagingError(null);

    const stagedGuests = guests
      .filter((g) => selectedGuestIds.has(g.id))
      .map((g) => {
        const assignedTable = tables.find((t) => t.id === g.tableId);
        return {
          guest_id: g.id,
          guest_name: g.name,
          recipient_email: g.email || '',
          table_name: assignedTable?.name || null,
        };
      });

    try {
      const res = await fetch('/api/invitations/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: activeEventId || 'default_event',
          event_name: activeEventName,
          message_type: 'INVITATION',
          message_cycle: 1,
          guests: stagedGuests,
          template: { subject, body_text: bodyText, reply_to: replyTo || undefined },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.existing_job_id) {
          setActiveJobId(data.existing_job_id);
          showToast('Job already exists with this payload');
        } else {
          setConfirmationToken(data.confirmation_token);
          setStagedSummary(data.summary);
        }
      } else {
        setStagingError(data.error || 'Failed to stage batch');
      }
    } catch (err: any) {
      setStagingError('Staging connection error');
    } finally {
      setStagingLoading(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (!confirmationToken) return;
    setStagingLoading(true);

    try {
      const res = await fetch('/api/invitations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_token: confirmationToken }),
      });

      const data = await res.json();
      if (res.ok) {
        setActiveJobId(data.job_id);
        setConfirmationToken(null);
        setStagedSummary(null);
        showToast(`Successfully queued ${data.total_queued} emails!`);
      } else {
        alert(`Confirmation failed: ${data.error}`);
      }
    } catch (err: any) {
      alert('Confirmation connection error');
    } finally {
      setStagingLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJobId) return;
    if (!confirm('Cancel remaining queued emails for this job?')) return;

    try {
      const res = await fetch(`/api/invitations/jobs/${activeJobId}/cancel`, { method: 'POST' });
      if (res.ok) {
        showToast('Job cancelled');
      }
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  const handleExportCsv = () => {
    if (!activeJobId) return;
    window.open(`/api/invitations/jobs/${activeJobId}/export`, '_blank');
  };

  // Render Login View if not authenticated
  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 border border-gilded-border shadow-3xs rounded-none">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-gilded-ink text-gilded-accent mb-3 border border-gilded-border">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-bold text-gilded-ink font-serif">Admin Authentication</h2>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Authenticate to access Gmail Invitation & Reminder controls
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gilded-ink font-mono uppercase mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              className="w-full px-3 py-2 border border-gilded-border text-sm font-sans focus:outline-none focus:ring-1 focus:ring-gilded-accent bg-gilded-faint/30"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 bg-gilded-ink hover:bg-black text-gilded-accent font-sans font-bold text-xs uppercase tracking-wider border border-gilded-border transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            <span>Authenticate Admin Session</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gilded-ink text-gilded-accent px-4 py-2.5 border border-gilded-border shadow-md text-xs font-sans font-bold flex items-center gap-2 animate-bounce">
          <Sparkles size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-5 border border-gilded-border shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-gilded-ink text-gilded-accent text-[9px] uppercase font-mono px-2 py-0.5 font-bold border border-gilded-border flex items-center gap-1">
              <Mail size={10} /> Gmail Studio
            </span>
            <h2 className="text-xl font-bold text-gilded-ink font-serif">
              Invitations & Reminders: {activeEventName}
            </h2>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            Personalized individual Gmail dispatch with rate limiting & audit logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gmailConnected ? (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 border border-emerald-200 text-xs font-mono font-semibold">
              <Check size={14} className="text-emerald-600" />
              <span>Connected: {gmailEmail}</span>
              <button
                onClick={handleDisconnectGmail}
                className="ml-2 text-gray-400 hover:text-red-600 text-xs cursor-pointer"
                title="Disconnect Gmail Account"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGmail}
              disabled={gmailLoading}
              className="px-4 py-2 bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-bold font-sans uppercase tracking-wider border border-gilded-border transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {gmailLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              <span>Connect Gmail Account</span>
            </button>
          )}

          <button
            onClick={handleAdminLogout}
            className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-600 cursor-pointer"
            title="Log out Admin Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template & Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white p-5 border border-gilded-border shadow-3xs space-y-4">
            <h3 className="text-sm font-bold text-gilded-ink font-serif uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-2">
              <FileText size={16} className="text-gilded-accent" /> Email Template Editor
            </h3>

            <div>
              <label className="block text-xs font-mono font-bold text-gray-600 uppercase mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gilded-border text-sm font-sans bg-gilded-faint/20 focus:ring-1 focus:ring-gilded-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-gray-600 uppercase mb-1">
                Body Text Template
              </label>
              <TipTapBodyEditor
                value={bodyText}
                onChange={setBodyText}
                onInsertImageRequest={() => setIsImageModalOpen(true)}
                lastInsertedImageHtml={lastInsertedImageHtml}
                onImageInsertedHandled={() => setLastInsertedImageHtml(null)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSendTestToSelf}
                disabled={!gmailConnected || testSending}
                className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-gilded-ink text-xs font-sans font-semibold border border-gray-300 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                {testSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Send Test to Myself</span>
              </button>

              <button
                type="button"
                onClick={handleStageBatch}
                disabled={!gmailConnected || selectedGuestIds.size === 0 || stagingLoading}
                className="px-5 py-2 bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-sans font-bold uppercase tracking-wider border border-gilded-border transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                {stagingLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Stage & Preview Batch ({selectedGuestIds.size} Guests)</span>
              </button>
            </div>

            {stagingError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{stagingError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recipient Selection Checklist (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 border border-gilded-border shadow-3xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-sm font-bold text-gilded-ink font-serif uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-gilded-accent" /> Recipient Checklist ({selectedGuestIds.size} Selected)
              </h3>

              <button
                onClick={handleToggleSelectAll}
                className="text-xs font-mono text-gilded-ink hover:text-gilded-accent font-semibold underline cursor-pointer"
              >
                {selectedGuestIds.size > 0 ? 'Deselect All' : 'Select All Eligible'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-500">Filter View:</span>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
                className="px-2 py-1 border border-gray-300 text-xs font-mono focus:border-gilded-accent outline-none"
              >
                <option value="all">All Guests ({guests.length})</option>
                <option value="seated">Seated Guests Only</option>
                <option value="unseated">Unseated Guests Only</option>
              </select>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 border-t border-gray-100 pt-2">
              {guests.map((g) => {
                const hasEmail = Boolean(g.email && g.email.trim() !== '');
                const isChecked = selectedGuestIds.has(g.id);

                return (
                  <div
                    key={g.id}
                    onClick={() => hasEmail && handleToggleGuest(g.id)}
                    className={`p-2 border text-xs font-sans flex items-center justify-between transition-colors ${
                      !hasEmail
                        ? 'opacity-40 bg-gray-50 border-gray-100 cursor-not-allowed'
                        : isChecked
                        ? 'bg-amber-50/40 border-gilded-accent/50 cursor-pointer'
                        : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!hasEmail}
                        onChange={() => {}}
                        className="rounded-none text-gilded-accent focus:ring-gilded-accent cursor-pointer"
                      />
                      <div>
                        <span className="font-bold text-gilded-ink block truncate">{g.name}</span>
                        <span className="text-[11px] text-gray-400 font-mono block truncate">
                          {g.email || 'No email address'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200">
                        {getTableAssignmentName(g)}
                      </span>
                      {hasEmail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewGuestId(g.id);
                          }}
                          className="p-1 hover:bg-gilded-accent/20 border border-gray-200 hover:border-gilded-accent text-gilded-ink transition-colors cursor-pointer flex items-center gap-1"
                          title="Preview personalized email for this guest"
                        >
                          <Eye size={12} />
                          <span className="text-[9px] font-mono font-bold uppercase">Preview</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Staging Summary Modal */}
      {confirmationToken && stagedSummary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full p-6 border border-gilded-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gilded-ink font-serif flex items-center gap-2">
                <Sparkles size={18} className="text-gilded-accent" /> Confirm Staged Email Dispatch
              </h3>
              <button onClick={() => setConfirmationToken(null)} className="text-gray-400 hover:text-black">
                <XCircle size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800">
                <span className="text-lg font-bold block">{stagedSummary.valid_recipient_count}</span>
                <span>Valid Recipients Queued</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700">
                <span className="text-lg font-bold block">{stagedSummary.skipped_no_email_count}</span>
                <span>Skipped (No Email)</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700">
                <span className="text-lg font-bold block">{stagedSummary.skipped_suppressed_count}</span>
                <span>Skipped (Opted Out)</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700">
                <span className="text-lg font-bold block">{stagedSummary.skipped_already_sent_count}</span>
                <span>Skipped (Already Sent)</span>
              </div>
            </div>

            <div className="p-3 bg-gilded-faint/30 border border-gilded-border text-xs space-y-1 font-mono">
              <span className="font-bold text-gilded-ink block">Subject Preview:</span>
              <p className="text-gray-700 italic">{stagedSummary.subject_preview}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setConfirmationToken(null)}
                className="px-4 py-2 border border-gray-300 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBatch}
                disabled={stagingLoading}
                className="px-5 py-2 bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-sans font-bold uppercase tracking-wider border border-gilded-border flex items-center gap-1.5"
              >
                {stagingLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Confirm & Send ({stagedSummary.valid_recipient_count} Emails)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Job Monitoring Dashboard */}
      {jobStatus && (
        <div className="bg-white p-5 border border-gilded-border shadow-3xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase bg-gilded-ink text-gilded-accent px-2 py-0.5 font-bold border border-gilded-border">
                Queue Status: {jobStatus.status}
              </span>
              <h3 className="text-lg font-bold text-gilded-ink font-serif mt-1">
                Batch Progress: {jobStatus.sent + jobStatus.failed + jobStatus.unknown + jobStatus.cancelled} / {jobStatus.total} Processed
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-white border border-gray-300 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                <span>Export CSV Report</span>
              </button>

              {jobStatus.status === 'PROCESSING' || jobStatus.status === 'QUEUED' ? (
                <button
                  onClick={handleCancelJob}
                  className="px-3 py-1.5 bg-red-50 border border-red-200 text-xs font-sans font-semibold text-red-700 hover:bg-red-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle size={13} />
                  <span>Cancel Remaining</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-100 h-3 border border-gray-200 overflow-hidden">
            <div
              className="bg-gilded-accent h-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((jobStatus.sent + jobStatus.failed + jobStatus.unknown + jobStatus.cancelled) / Math.max(1, jobStatus.total)) * 100
                  )
                )}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs font-mono">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200">
              <span className="text-base font-bold text-emerald-800 block">{jobStatus.sent}</span>
              <span className="text-[10px] text-emerald-600 uppercase">Accepted by Gmail</span>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200">
              <span className="text-base font-bold text-red-800 block">{jobStatus.failed}</span>
              <span className="text-[10px] text-red-600 uppercase">Failed</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200">
              <span className="text-base font-bold text-amber-800 block">{jobStatus.unknown}</span>
              <span className="text-[10px] text-amber-600 uppercase">Unknown (Review)</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200">
              <span className="text-base font-bold text-slate-800 block">{jobStatus.cancelled}</span>
              <span className="text-[10px] text-slate-600 uppercase">Cancelled</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200">
              <span className="text-base font-bold text-slate-800 block">{jobStatus.estimated_remaining_seconds}s</span>
              <span className="text-[10px] text-slate-600 uppercase">Est. Remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* Inline Image Crop & Resize Modal */}
      <ImageCropModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsertImage={handleInsertImageToBodyText}
        currentTemplateHtml={bodyText}
      />

      {/* Recipient Specific Email Preview Modal with Backdrop Blur */}
      {previewGuest && (
        <div className="fixed inset-0 z-50 bg-gilded-ink/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white max-w-2xl w-full border border-gilded-border shadow-2xl overflow-hidden rounded-none flex flex-col max-h-[90vh]">
            <div className="px-5 py-3 border-b border-gilded-border bg-gilded-bg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-gilded-accent" />
                <h3 className="font-serif font-medium text-gilded-ink text-base">Recipient Email Preview</h3>
              </div>
              <button
                onClick={() => setPreviewGuestId(null)}
                className="p-1 text-gray-400 hover:text-gilded-ink cursor-pointer"
              >
                <XCircle size={16} />
              </button>
            </div>

            {/* Recipient Meta Bar */}
            <div className="px-5 py-2.5 bg-gilded-faint/30 border-b border-gilded-border flex items-center justify-between text-xs font-mono">
              <div>
                <span className="font-bold text-gilded-ink">{previewGuest.name}</span>
                <span className="text-gray-500 ml-2">&lt;{previewGuest.email}&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gilded-accent/20 border border-gilded-accent text-gilded-ink text-[10px] font-semibold uppercase">
                  {getTableAssignmentName(previewGuest)}
                </span>
                <span className="text-gray-400">
                  Guest {currentPreviewIndex + 1} of {eligibleGuests.length}
                </span>
              </div>
            </div>

            {/* Rendered Email Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="bg-white p-5 border border-gray-200 shadow-3xs mb-4">
                <div className="text-xs font-mono text-gray-500 pb-2 border-b border-gray-100 mb-4">
                  <span className="font-bold text-gray-700">Subject:</span> {renderTextTemplate(subject, getGuestContext(previewGuest))}
                </div>
                <div
                  className="text-xs font-sans text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: renderHtmlFromText(bodyText, getGuestContext(previewGuest)),
                  }}
                />
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-5 py-3 border-t border-gilded-border bg-gilded-bg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPreviewIndex <= 0}
                  onClick={() => setPreviewGuestId(eligibleGuests[currentPreviewIndex - 1]?.id || null)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-700 border border-gray-300 text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  disabled={currentPreviewIndex >= eligibleGuests.length - 1}
                  onClick={() => setPreviewGuestId(eligibleGuests[currentPreviewIndex + 1]?.id || null)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-700 border border-gray-300 text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewGuestId(null)}
                className="px-4 py-1.5 bg-gilded-ink hover:bg-black text-white text-xs font-mono uppercase tracking-wider cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
