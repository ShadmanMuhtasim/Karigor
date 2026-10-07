import React, { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { paymentApi } from '../api/paymentApi';

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();

  // The URL supplies only a lookup hint. Status, amount and receipt fields are never trusted.
  const bookingHint = searchParams.get('bookingId');
  const parsedId = bookingHint && /^[1-9][0-9]*$/.test(bookingHint) ? Number(bookingHint) : NaN;
  const bookingId = Number.isSafeInteger(parsedId) && parsedId <= 2_147_483_647 ? parsedId : null;
  const paymentQuery = useQuery({
    queryKey: ['paymentReturn', user?.userId, bookingId],
    queryFn: () => paymentApi.getBookingPayment(bookingId!),
    enabled: !!user && !isLoading && bookingId !== null,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['customerBookings'] });
    queryClient.invalidateQueries({ queryKey: ['workerBookings'] });
    queryClient.invalidateQueries({ queryKey: ['bookingPayment'] });
    if (bookingId !== null) queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
  }, [queryClient, bookingId]);

  const payment = paymentQuery.data?.bookingId === bookingId ? paymentQuery.data : undefined;
  const checking = isLoading || paymentQuery.isFetching;
  const isSuccess = !checking && !paymentQuery.isError && !!user &&
    payment?.status === 'Completed' && !!payment.paidAt;
  const heading = checking ? 'Checking Payment Status' : isSuccess ? 'Payment Confirmed' : 'Payment Not Confirmed';
  const explanation = checking
    ? 'Loading the payment record from Karigor.'
    : isSuccess
    ? 'Karigor has a completed payment record for this booking.'
    : !user
    ? 'Sign in to check the payment record for your booking.'
    : bookingId === null
    ? 'Open your booking to check its payment status.'
    : 'We cannot confirm a completed payment. Check your booking or retry the status check before attempting another payment.';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="text-4xl" aria-hidden="true">{isSuccess ? '✓' : '…'}</div>
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-black">{heading}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{explanation}</p>
          </div>
          {payment && !paymentQuery.isError && (
            <dl className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 text-left text-sm space-y-2">
              <div><dt className="inline">Booking: </dt><dd className="inline font-bold">#{payment.bookingId}</dd></div>
              <div><dt className="inline">Transaction: </dt><dd className="inline font-mono">{payment.transactionId}</dd></div>
              <div><dt className="inline">{isSuccess ? 'Amount paid: ' : 'Payment amount: '}</dt>
                <dd className="inline font-bold">{payment.currency} {payment.totalAmount.toLocaleString()}</dd></div>
              <div><dt className="inline">Recorded status: </dt><dd className="inline">{payment.status}</dd></div>
            </dl>
          )}
          {isSuccess && <p className="text-xs text-gray-500">Payment confirmation does not confirm an artisan payout.</p>}
          <div className="flex flex-wrap justify-center gap-3">
            {!user && !isLoading && <Link to="/login" className="font-bold text-emerald-600">Sign in</Link>}
            {user && bookingId !== null && !isSuccess && (
              <button type="button" disabled={checking} onClick={() => paymentQuery.refetch()}
                className="font-bold text-emerald-600 disabled:opacity-50">Check Status Again</button>
            )}
            <button type="button" onClick={() => navigate('/dashboard')}
              className="font-bold text-gray-600 dark:text-gray-300">Go to Dashboard</button>
            {user && bookingId !== null && <Link to={`/bookings/${bookingId}`}
              className="font-bold text-emerald-600">View Booking Details</Link>}
          </div>
        </div>
      </main>
    </div>
  );
};
