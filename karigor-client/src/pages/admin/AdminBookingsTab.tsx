import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminBookings } from '../../api/adminApi';
import type { AdminBookingDto } from '../../api/adminApi';

export const AdminBookingsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingDto | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['adminBookings', statusFilter, searchTerm],
    queryFn: () => getAdminBookings(statusFilter === 'All' ? undefined : statusFilter, searchTerm),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'InProgress':
        return 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'Cancelled':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Filter Pills */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white">Platform Booking Monitor</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time tracking of all active, scheduled, and completed service engagements.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl">
          {['All', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
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
          placeholder="Search by customer, worker, or service category..."
          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
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

      {/* Bookings Table / List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">Loading platform bookings...</p>
        </div>
      ) : bookings?.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl">
          <div className="text-4xl mb-3">📋</div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white">No bookings match this filter</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">There are no bookings matching the selected criteria.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 uppercase tracking-wider text-[10px] font-bold text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Booking / Service</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Artisan</th>
                  <th className="py-3.5 px-4">Agreed Price</th>
                  <th className="py-3.5 px-4">Scheduled Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {bookings?.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                    <td className="py-4 px-4 sm:px-6">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white text-xs">🛠️ {b.categoryName}</span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">Booking #{b.id} (Req #{b.serviceRequestId})</p>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{b.customerName}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{b.customerEmail}</p>
                    </td>

                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{b.workerName}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{b.workerEmail}</p>
                    </td>

                    <td className="py-4 px-4 font-bold text-amber-600 dark:text-amber-400">
                      ৳{b.agreedPrice.toLocaleString()}
                    </td>

                    <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                      {new Date(b.scheduledDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(b.status)}`}>
                          {b.status}
                        </span>
                        {b.hasReview && (
                          <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-bold">
                            ⭐ {b.reviewRating}★
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
                      >
                        Inspect ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h4 className="text-base font-black text-gray-900 dark:text-white">
                  Booking #{selectedBooking.id} Details
                </h4>
                <p className="text-xs text-gray-500">Service Request #{selectedBooking.serviceRequestId}</p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Service Category</span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">🛠️ {selectedBooking.categoryName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block text-right">Agreed Value</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 text-sm">৳{selectedBooking.agreedPrice.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Customer</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{selectedBooking.customerName}</p>
                  <p className="text-[11px] text-gray-500">{selectedBooking.customerEmail}</p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Artisan / Worker</span>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{selectedBooking.workerName}</p>
                  <p className="text-[11px] text-gray-500">{selectedBooking.workerEmail}</p>
                </div>
              </div>

              {selectedBooking.address && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Service Address</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200 mt-1">📍 {selectedBooking.address}</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Scheduled Date</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                    📅 {new Date(selectedBooking.scheduledDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block text-right">Status</span>
                  <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
