import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RegisterCustomerPage() {
  const { registerAsCustomer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', address: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerAsCustomer({ email: form.email, password: form.password, fullName: form.fullName, address: form.address || undefined });
      navigate('/dashboard/customer', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Karigor</h1>
          <p className="text-gray-400">Create your customer account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" id="register-customer-form">
            {error && (
              <div id="register-customer-error" className="bg-red-900/40 border border-red-600 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {[
              { id: 'rc-fullname', name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
              { id: 'rc-email', name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { id: 'rc-password', name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
              { id: 'rc-address', name: 'address', label: 'Address (optional)', type: 'text', placeholder: 'Your address' },
            ].map(({ id, name, label, type, placeholder }) => (
              <div key={name}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                <input
                  id={id}
                  name={name}
                  type={type}
                  value={form[name as keyof typeof form]}
                  onChange={onChange}
                  required={name !== 'address'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  placeholder={placeholder}
                />
              </div>
            ))}

            <button
              id="register-customer-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition duration-200"
            >
              {loading ? 'Creating account…' : 'Create Customer Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
