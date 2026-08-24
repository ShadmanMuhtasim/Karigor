import { Navbar } from '../components/Navbar';
import { CustomerSearchTab } from './customer/CustomerSearchTab';

export function SearchWorkersPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <CustomerSearchTab />
      </main>
    </div>
  );
}
