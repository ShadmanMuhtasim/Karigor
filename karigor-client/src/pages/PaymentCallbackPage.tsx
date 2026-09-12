import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const status = searchParams.get('status') || 'unknown';
  const bookingId = searchParams.get('bookingId');
  const tranId = searchParams.get('tranId');
  const amount = searchParams.get('amount');
  const message = searchParams.get('message');

  const [countdown, setCountdown] = useState(6);

  const isSuccess = status.toLowerCase() === 'success';
  const isCancelled = status.toLowerCase() === 'cancelled';

  useEffect(() => {
    // Invalidate queries so that booking status and payment status reflect immediately
    queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
    if (bookingId) {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingPayment', bookingId] });
    }
  }, [queryClient, bookingId]);

  useEffect(() => {
    if (!isSuccess) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/dashboard/customer');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSuccess, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 sm:p-10 shadow-xl text-center space-y-6 animate-fade-in">
          
          {/* Status Icon */}
          {isSuccess ? (
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/10 animate-bounce-subtle">
              ✓
            </div>
          ) : isCancelled ? (
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-4xl shadow-lg shadow-amber-500/10">
              ⚠️
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center text-4xl shadow-lg shadow-rose-500/10">
              ✕
            </div>
          )}

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              {isSuccess
                ? 'Payment Successful!'
                : isCancelled
                ? 'Payment Cancelled'
                : 'Payment Failed'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {isSuccess
                ? 'Your payment has been verified and processed securely via SSLCommerz.'
                : isCancelled
                ? 'You cancelled the transaction before completing payment. No charges were made.'
                : message || 'We could not process your transaction. Please try again or use another payment method.'}
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 text-left space-y-2.5 text-xs">
            {bookingId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Booking ID:</span>
                <span className="font-bold text-gray-900 dark:text-white">#{bookingId}</span>
              </div>
            )}
            {tranId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Transaction ID:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">{tranId}</span>
              </div>
            )}
            {amount && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Amount Paid:</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">৳ {Number(amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Payment Gateway:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">SSLCommerz (Sandbox)</span>
            </div>
            {isSuccess && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Platform fee and service charges (6%) applied • 94% credited to artisan</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/customer')}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                Go to My Bookings
              </button>
              {bookingId && (
                <Link
                  to={`/bookings/${bookingId}`}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs transition text-center"
                >
                  View Booking Details
                </Link>
              )}
            </div>

            {isSuccess && countdown > 0 && (
              <p className="text-[11px] text-gray-400">
                Redirecting to your dashboard in <span className="font-bold text-emerald-600 dark:text-emerald-400">{countdown}s</span>…
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
