import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getSosAlerts,
  updateSosStatus,
  terminateSosJob,
} from '../../api/sosApi';
import type { SosAlertDto } from '../../api/sosApi';
import { signalRService } from '../../services/signalrService';
import { extractErrorMessage } from '../../lib/errorUtils';
import { Modal } from '../../components/ui/Modal';
import {
  SirenIcon,
  ShieldCheckIcon,
  CheckIcon,
  CheckCircleIcon,
  CloseIcon,
  AlertTriangleIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  WrenchIcon,
  MapPinIcon,
  FileTextIcon,
  StopIcon,
  SmartphoneIcon,
} from '../../components/icons/Icons';

export const AdminSosTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [filterMode, setFilterMode] = useState<'active' | 'all'>('active');
  const [contactModal, setContactModal] = useState<{
    role: 'Customer' | 'Worker';
    name: string;
    phone?: string;
    email?: string;
    bookingId: number;
  } | null>(null);

  const [terminateModal, setTerminateModal] = useState<SosAlertDto | null>(null);
  const [terminateNotes, setTerminateNotes] = useState('');

  // Per-alert notes drafts
  const [notesDrafts, setNotesDrafts] = useState<Record<number, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Ticking time state to re-render elapsed time every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to SignalR real-time SOS alerts
  useEffect(() => {
    const unsub = signalRService.onSosAlert(() => {
      queryClient.invalidateQueries({ queryKey: ['adminSosAlerts'] });
    });
    return unsub;
  }, [queryClient]);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['adminSosAlerts', filterMode],
    queryFn: () => getSosAlerts(filterMode === 'active' ? 'unresolved' : 'all'),
    refetchInterval: 10000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number; status: 'Open' | 'Contacted' | 'Resolved' | 'Escalated'; adminNotes?: string }) =>
      updateSosStatus(id, { status, adminNotes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminSosAlerts'] });
      setSuccessMsg(`Alert #${updated.id} status updated to ${updated.status}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to update alert status.'));
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  const terminateJobMutation = useMutation({
    mutationFn: ({ id, adminNotes }: { id: number; adminNotes?: string }) =>
      terminateSosJob(id, { adminNotes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminSosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      setTerminateModal(null);
      setTerminateNotes('');
      setSuccessMsg(`Booking #${updated.bookingId} cancelled and SOS Alert #${updated.id} resolved.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to terminate booking.'));
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  const formatElapsed = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
    if (diffSec < 60) return t('common.justNow', 'Just now');
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-rose-600 text-white font-black animate-pulse shadow-sm shadow-rose-600/40';
      case 'Contacted':
        return 'bg-amber-500 text-white font-bold';
      case 'Escalated':
        return 'bg-purple-700 text-white font-black shadow-sm shadow-purple-600/40';
      case 'Resolved':
        return 'bg-emerald-600 text-white font-bold';
      default:
        return 'bg-gray-600 text-white font-semibold';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Urgency Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 rounded-3xl text-white shadow-xl shadow-rose-700/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>{t('admin.sos.commandTitle', 'Emergency Dispatch & Safety Response')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <SirenIcon className="w-6 h-6 text-white" />
            <span>{t('admin.sos.activeIncidents', 'Active SOS Incidents')}</span>
          </h2>
          <p className="text-rose-100 text-sm max-w-2xl leading-relaxed">
            {t('admin.sos.bannerDesc', 'Immediate response center for customers requesting emergency intervention during active service bookings. Review location, contact parties, or terminate jobs.')}
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center bg-black/20 p-1.5 rounded-2xl backdrop-blur-sm self-stretch md:self-auto justify-center">
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              filterMode === 'active'
                ? 'bg-white text-rose-700 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            {t('admin.sos.filterActive', 'Active & Unresolved')}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white text-rose-700 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            {t('admin.sos.filterAll', 'All Alert History')}
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4 text-emerald-600" /> {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-700 p-0.5"><CloseIcon className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-1.5"><AlertTriangleIcon className="w-4 h-4 text-rose-600" /> {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-700 p-0.5"><CloseIcon className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
            {t('common.loading', 'Loading SOS incidents…')}
          </p>
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center shadow-sm space-y-3">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheckIcon className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {t('admin.sos.allClearTitle', 'All Clear — No Active SOS Alerts')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {filterMode === 'active'
              ? t('admin.sos.allClearDesc', 'There are currently no unresolved safety alerts from customers.')
              : t('admin.sos.noAlertsHistory', 'No emergency alerts found in the database.')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {alerts.map((alert) => {
            const isUnresolved = alert.status !== 'Resolved';
            const noteDraft = notesDrafts[alert.id] !== undefined ? notesDrafts[alert.id] : (alert.adminNotes || '');

            return (
              <article
                key={alert.id}
                className={`rounded-3xl border-2 transition-all p-6 sm:p-8 space-y-6 bg-white dark:bg-gray-900 shadow-md ${
                  alert.status === 'Open'
                    ? 'border-rose-500/90 shadow-rose-500/10 ring-4 ring-rose-500/10'
                    : alert.status === 'Escalated'
                    ? 'border-purple-500/90 shadow-purple-500/10'
                    : alert.status === 'Contacted'
                    ? 'border-amber-500/80 shadow-amber-500/10'
                    : 'border-gray-200 dark:border-gray-800 opacity-90'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider ${getStatusBadge(alert.status)}`}>
                        {alert.status}
                      </span>
                      <span className="text-xs font-bold text-gray-400">•</span>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <SirenIcon className="w-3.5 h-3.5" />
                        <span>{formatElapsed(alert.triggeredAt)}</span>
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white pt-1">
                      Incident #{alert.id} — Booking #{alert.bookingId} ({alert.serviceCategoryName})
                    </h3>
                  </div>

                  {/* Status Dropdown / Actions */}
                  <div className="flex items-center gap-2">
                    <select
                      value={alert.status}
                      disabled={updateStatusMutation.isPending}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'Open' | 'Contacted' | 'Resolved' | 'Escalated';
                        updateStatusMutation.mutate({
                          id: alert.id,
                          status: newStatus,
                          adminNotes: noteDraft,
                        });
                      }}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="Open">Status: Open</option>
                      <option value="Contacted">Status: Contacted</option>
                      <option value="Escalated">Status: Escalated</option>
                      <option value="Resolved">Status: Resolved</option>
                    </select>

                    {isUnresolved && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: alert.id,
                            status: 'Resolved',
                            adminNotes: noteDraft,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        className="btn-press px-3.5 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>{t('admin.sos.markResolved', 'Resolve')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Customer Card */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{t('admin.sos.reportingCustomer', 'Customer')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setContactModal({
                            role: 'Customer',
                            name: alert.customerName,
                            phone: alert.customerPhone,
                            email: alert.customerEmail,
                            bookingId: alert.bookingId,
                          })
                        }
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-500 cursor-pointer flex items-center gap-1"
                      >
                        <PhoneIcon className="w-3 h-3" />
                        <span>{t('admin.sos.contact', 'Contact')}</span>
                      </button>
                    </div>
                    <div className="font-extrabold text-sm text-gray-900 dark:text-white">
                      {alert.customerName}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="flex items-center gap-1.5"><PhoneIcon className="w-3 h-3 text-gray-400 shrink-0" /> <span>{alert.customerPhone || 'No phone recorded'}</span></div>
                      <div className="flex items-center gap-1.5 truncate"><MailIcon className="w-3 h-3 text-gray-400 shrink-0" /> <span className="truncate">{alert.customerEmail || 'No email'}</span></div>
                    </div>
                  </div>

                  {/* Worker Card */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <WrenchIcon className="w-3.5 h-3.5 text-gray-400" />
                        <span>{t('admin.sos.assignedArtisan', 'Artisan / Worker')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setContactModal({
                            role: 'Worker',
                            name: alert.workerName,
                            phone: alert.workerPhone,
                            email: alert.workerEmail,
                            bookingId: alert.bookingId,
                          })
                        }
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-500 cursor-pointer flex items-center gap-1"
                      >
                        <PhoneIcon className="w-3 h-3" />
                        <span>{t('admin.sos.contact', 'Contact')}</span>
                      </button>
                    </div>
                    <div className="font-extrabold text-sm text-gray-900 dark:text-white">
                      {alert.workerName}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div className="flex items-center gap-1.5"><PhoneIcon className="w-3 h-3 text-gray-400 shrink-0" /> <span>{alert.workerPhone || 'No phone recorded'}</span></div>
                      <div className="flex items-center gap-1.5 truncate"><MailIcon className="w-3 h-3 text-gray-400 shrink-0" /> <span className="truncate">{alert.workerEmail || 'No email'}</span></div>
                    </div>
                  </div>

                  {/* Booking & Address Card */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 space-y-2">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                      <span>{t('admin.sos.serviceLocation', 'Service Address & Job')}</span>
                    </div>
                    <div className="text-xs text-gray-800 dark:text-gray-200 font-bold line-clamp-2">
                      {alert.serviceAddress}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                      <span>Agreed: ৳{alert.agreedPrice.toLocaleString()}</span>
                      <span className="font-semibold">Booking: {alert.bookingStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Admin Notes & Terminate Action */}
                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                      <FileTextIcon className="w-4 h-4 text-rose-800 dark:text-rose-300" />
                      <span>{t('admin.sos.incidentNotes', 'Admin Incident Notes & Action History')}</span>
                    </label>

                    {/* Terminate Job Button */}
                    {isUnresolved && alert.bookingStatus !== 'Cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTerminateModal(alert);
                          setTerminateNotes('');
                        }}
                        className="btn-press px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                      >
                        <StopIcon className="w-3.5 h-3.5" />
                        <span>{t('admin.sos.terminateJob', 'Terminate Job')}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder={t('admin.sos.notesPlaceholder', 'Add incident log, officer contacted, or triage note...')}
                      value={noteDraft}
                      onChange={(e) =>
                        setNotesDrafts((prev) => ({
                          ...prev,
                          [alert.id]: e.target.value,
                        }))
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: alert.id,
                          status: alert.status,
                          adminNotes: noteDraft,
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                      className="btn-press px-4 py-2.5 text-xs font-bold rounded-xl bg-gray-900 hover:bg-black dark:bg-gray-800 dark:hover:bg-gray-700 text-white shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      {t('admin.sos.saveNotes', 'Save Note')}
                    </button>
                  </div>

                  {alert.resolvedAt && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                      Resolved on {new Date(alert.resolvedAt).toLocaleString()}
                      {alert.resolvedByAdminEmail ? ` by ${alert.resolvedByAdminEmail}` : ''}.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Contact Modal */}
      {contactModal && (
        <Modal
          isOpen={!!contactModal}
          onClose={() => setContactModal(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-sky-600" />
                <span>Contact {contactModal.role}</span>
              </h3>
              <button
                onClick={() => setContactModal(null)}
                className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer p-1"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 py-2">
              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase">Name</span>
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {contactModal.name}
                </span>
              </div>

              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase">Phone Number</span>
                {contactModal.phone ? (
                  <a
                    href={`tel:${contactModal.phone}`}
                    className="text-sm font-bold text-sky-600 hover:underline flex items-center gap-1.5 mt-0.5"
                  >
                    <SmartphoneIcon className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>{contactModal.phone}</span>
                    <span className="text-[10px] ml-1 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-md">Tap to Call</span>
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">No phone provided</span>
                )}
              </div>

              <div>
                <span className="text-xs text-gray-400 block font-bold uppercase">Email Address</span>
                {contactModal.email ? (
                  <a
                    href={`mailto:${contactModal.email}`}
                    className="text-sm font-bold text-sky-600 hover:underline flex items-center gap-1.5 mt-0.5 truncate"
                  >
                    <MailIcon className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="truncate">{contactModal.email}</span>
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">No email provided</span>
                )}
              </div>
            </div>

            <button
              onClick={() => setContactModal(null)}
              className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Terminate Job Confirmation Modal */}
      {terminateModal && (
        <Modal
          isOpen={!!terminateModal}
          onClose={() => setTerminateModal(null)}
          backdropClassName="bg-black/70 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-gray-900 border-2 border-rose-600 rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 animate-scale-in">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center">
              <StopIcon className="w-8 h-8 text-rose-600" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {t('admin.sos.terminateModalTitle', 'Terminate Booking')} #{terminateModal.bookingId}?
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('admin.sos.terminateModalWarning', 'This will immediately cancel the active booking, issue emergency cancellation notifications to customer and worker, and mark this SOS incident as Resolved.')}
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {t('admin.sos.terminationReason', 'Termination Justification / Audit Notes')}
              </label>
              <textarea
                rows={3}
                value={terminateNotes}
                onChange={(e) => setTerminateNotes(e.target.value)}
                placeholder="Reason for job termination (e.g., Unsafe behavior reported, Police dispatched, Worker removed)..."
                className="w-full p-3 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTerminateModal(null)}
                disabled={terminateJobMutation.isPending}
                className="w-1/2 py-2.5 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="button"
                onClick={() =>
                  terminateJobMutation.mutate({
                    id: terminateModal.id,
                    adminNotes: terminateNotes,
                  })
                }
                disabled={terminateJobMutation.isPending}
                className="w-1/2 py-2.5 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {terminateJobMutation.isPending ? (
                  'Terminating...'
                ) : (
                  <>
                    <StopIcon className="w-4 h-4" />
                    <span>Terminate Job</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
