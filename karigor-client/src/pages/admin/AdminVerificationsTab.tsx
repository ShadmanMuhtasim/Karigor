import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingWorkers, verifyWorker } from '../../api/adminApi';
import type { PendingWorkerDto, WorkerVerificationDocumentDto } from '../../api/adminApi';
import { extractErrorMessage } from '../../lib/errorUtils';
import { getFileUrl } from '../../api/client';

export const AdminVerificationsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<WorkerVerificationDocumentDto | null>(null);
  const [actionWorker, setActionWorker] = useState<{ worker: PendingWorkerDto; action: 'Verified' | 'Rejected' } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: workers, isLoading } = useQuery({
    queryKey: ['adminWorkers', statusFilter, searchTerm],
    queryFn: () => getPendingWorkers(statusFilter, searchTerm),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ workerId, status, note }: { workerId: number; status: 'Verified' | 'Rejected'; note?: string }) =>
      verifyWorker(workerId, { status, note }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['adminWorkers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setActionWorker(null);
      setAdminNote('');
      setSuccessMsg(`Worker #${updated.workerId} (${updated.email}) status set to ${updated.verificationStatus}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err, 'Failed to update verification status.'));
    },
  });

  const handleConfirmAction = () => {
    if (!actionWorker) return;
    setErrorMsg('');
    verifyMutation.mutate({
      workerId: actionWorker.worker.workerId,
      status: actionWorker.action,
      note: adminNote,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Rejected':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">Artisan Verification Queue</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Review uploaded identification credentials and verify skilled service providers.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
          {['Pending', 'Verified', 'Rejected', 'All'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === s
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by worker email or bio keywords..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Workers List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">Loading worker applications...</p>
        </div>
      ) : workers?.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl">
          <div className="text-4xl mb-3">🛡️</div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">No workers match this filter</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            There are currently no worker profiles in the <span className="font-semibold">{statusFilter}</span> queue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workers?.map((worker) => (
            <div
              key={worker.workerId}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm hover:shadow transition"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-lg flex items-center justify-center">
                    {worker.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">{worker.email}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(worker.verificationStatus)}`}>
                        {worker.verificationStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Worker ID: #{worker.workerId} • Hourly Rate: <span className="font-bold text-gray-900 dark:text-white">৳{worker.hourlyRate}/hr</span> • Radius: {worker.serviceRadiusKm} km
                    </p>
                  </div>
                </div>

                {/* Verification Action Buttons */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  {worker.verificationStatus !== 'Verified' && (
                    <button
                      onClick={() => setActionWorker({ worker, action: 'Verified' })}
                      className="flex-1 lg:flex-initial px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                      ✓ Approve Verification
                    </button>
                  )}
                  {worker.verificationStatus !== 'Rejected' && (
                    <button
                      onClick={() => setActionWorker({ worker, action: 'Rejected' })}
                      className="flex-1 lg:flex-initial px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                    >
                      ✕ Reject
                    </button>
                  )}
                </div>
              </div>

              {/* Bio & Skills */}
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1">
                    Specializations & Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {worker.skills.length > 0 ? (
                      worker.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-medium"
                        >
                          🛠️ {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">No skills assigned</span>
                    )}
                  </div>
                  {worker.bio && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      "{worker.bio}"
                    </p>
                  )}
                </div>

                {/* Submitted Documents */}
                <div>
                  <span className="text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1">
                    Verification Documents ({worker.documents.length})
                  </span>
                  {worker.documents.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No verification documents submitted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {worker.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <div>
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{doc.documentType}</p>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">Status: {doc.status}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            className="px-3 py-1 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 rounded-lg text-xs font-bold border border-sky-200 dark:border-sky-800 transition cursor-pointer"
                          >
                            Inspect Document ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Preview Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>📄</span>
                <span>Document: {selectedDoc.documentType}</span>
              </h4>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
              {selectedDoc.fileUrl.endsWith('.pdf') ? (
                <div className="flex flex-col items-center w-full">
                  <iframe 
                    src={getFileUrl(selectedDoc.fileUrl)}
                    className="w-full h-[60vh] rounded-xl border border-gray-200 dark:border-gray-700 bg-white"
                    title={selectedDoc.documentType}
                  />
                  <div className="mt-4">
                    <a
                      href={getFileUrl(selectedDoc.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-xs transition"
                    >
                      Open PDF in New Tab ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <img
                    src={getFileUrl(selectedDoc.fileUrl)}
                    alt={selectedDoc.documentType}
                    className="max-h-[60vh] mx-auto rounded-xl object-contain shadow-sm"
                  />
                  <div className="mt-4">
                    <a
                      href={getFileUrl(selectedDoc.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-xs transition"
                    >
                      Open Image in New Tab ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-lg font-black text-gray-900 dark:text-white">
              {actionWorker.action === 'Verified' ? '✓ Approve Worker Verification' : '✕ Reject Worker Verification'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Are you sure you want to set the status of <span className="font-bold">{actionWorker.worker.email}</span> to{' '}
              <span className={`font-bold ${actionWorker.action === 'Verified' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {actionWorker.action}
              </span>?
            </p>

            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">
                Admin Note / Feedback (Optional)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Reason or feedback provided to the worker..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionWorker(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={verifyMutation.isPending}
                className={`px-5 py-2 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50 ${
                  actionWorker.action === 'Verified' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                }`}
              >
                {verifyMutation.isPending ? 'Processing…' : `Confirm ${actionWorker.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
