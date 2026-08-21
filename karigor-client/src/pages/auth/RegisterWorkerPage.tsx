import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';

interface Category { id: number; name: string; }

export function RegisterWorkerPage() {
  const { registerAsWorker } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', bio: '', hourlyRate: '' });
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.get<Category[]>('/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleCategory(id: number) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (selectedCategories.length === 0) { setError('Select at least one service category.'); return; }
    const rate = parseFloat(form.hourlyRate);
    if (isNaN(rate) || rate <= 0) { setError('Enter a valid hourly rate.'); return; }
    setLoading(true);
    try {
      await registerAsWorker({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        bio: form.bio || undefined,
        hourlyRate: rate,
        categoryIds: selectedCategories,
      });
      navigate('/dashboard/worker', { replace: true });
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Karigor</h1>
          <p className="text-gray-400">Create your worker account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" id="register-worker-form">
            {error && (
              <div id="register-worker-error" className="bg-red-900/40 border border-red-600 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {[
              { id: 'rw-fullname', name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
              { id: 'rw-email', name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { id: 'rw-password', name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
              { id: 'rw-hourlyrate', name: 'hourlyRate', label: 'Hourly Rate (BDT)', type: 'number', placeholder: 'e.g. 500' },
            ].map(({ id, name, label, type, placeholder }) => (
              <div key={name}>
                <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
                <input
                  id={id} name={name} type={type} value={form[name as keyof typeof form]}
                  onChange={onChange} required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  placeholder={placeholder}
                />
              </div>
            ))}

            <div>
              <label htmlFor="rw-bio" className="block text-sm font-medium text-gray-300 mb-1">Bio (optional)</label>
              <textarea
                id="rw-bio" name="bio" value={form.bio} onChange={onChange} rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-none"
                placeholder="Briefly describe your skills and experience"
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-300 mb-2">Service Categories <span className="text-red-400">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id} type="button" id={`rw-cat-${cat.id}`}
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium border transition ${
                      selectedCategories.includes(cat.id)
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-emerald-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="register-worker-submit" type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition duration-200"
            >
              {loading ? 'Creating account…' : 'Create Worker Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
