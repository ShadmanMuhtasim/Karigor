import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/marketplaceApi';
import { Link } from 'react-router-dom';

export function CustomerBookingsTab() {
  const { data: bookings, isLoading, isError } = useQuery({ queryKey: ['customerBookings'], queryFn: marketplaceApi.getCustomerBookings });
  if (isLoading) return <p className="text-gray-500 dark:text-gray-400">Loading bookings...</p>;
  if (isError) return <p className="text-rose-500">Could not load your bookings.</p>;
  if (!bookings?.length) return <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">No bookings yet. Accept a worker quotation to create one.</div>;
  return <div className="space-y-4">{bookings.map(b => <article key={b.id} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold text-indigo-600 dark:text-sky-400">{b.categoryName}</p><h3 className="font-bold text-gray-900 dark:text-white">Booking #{b.id} with {b.workerName}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">📍 {b.address}</p></div><span className="h-fit rounded-full bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">{b.status}</span></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4 text-sm"><span className="text-gray-600 dark:text-gray-300">৳ {b.agreedPrice.toLocaleString()}</span><Link to={`/bookings/${b.id}`} className="font-bold text-sky-600 hover:underline dark:text-sky-400">View details</Link></div></article>)}</div>;
}
