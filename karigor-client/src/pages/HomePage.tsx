import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

// Assets
import workersInLineImg from '../assets/workers-in-line.jpg';
import plumberImg from '../assets/plumber_images.jpg';
import insidePainterImg from '../assets/inside-wall-painterimages.jpg';
import outsidePainterImg from '../assets/outside-wall-painterimages.jpg';
import electricianImg from '../assets/electrician-with-gloves.jpg';
import alltypeImg from '../assets/alltype.png';

export function HomePage() {
  const { user } = useAuth();

  const workerStories = [
    {
      title: 'Solidarity & Professional Pride',
      subtitle: '5,000+ Registered Craftsmen Across Bangladesh',
      image: workersInLineImg,
      badge: 'Community',
      badgeColor: 'bg-emerald-500 text-white',
      desc: 'Karigor brings thousands of independent tradesmen into a recognized, respected professional community with identity verification, safety standards, and collective dignity.',
    },
    {
      title: 'Precision Plumbing & Sanitary Care',
      subtitle: 'Modern Toolkits & Fair Diagnostic Rates',
      image: plumberImg,
      badge: 'Plumbing',
      badgeColor: 'bg-sky-500 text-white',
      desc: 'Certified plumbers earn 100% of their agreed quotation without middlemen taking unfair cuts. Every service call respects the technical expertise of the artisan.',
    },
    {
      title: 'Master Interior Wall Finishing',
      subtitle: 'Transforming Homes with Clean Artistic Craft',
      image: insidePainterImg,
      badge: 'Interior Painting',
      badgeColor: 'bg-amber-500 text-white',
      desc: 'Skilled interior painters showcase their past portfolios, receive direct customer reviews, and build a lasting reputation with high-trust clients.',
    },
    {
      title: 'High-Elevation Exterior Coating',
      subtitle: 'Safety-First Scaffolding & Weatherproofing',
      image: outsidePainterImg,
      badge: 'Exterior Coating',
      badgeColor: 'bg-indigo-500 text-white',
      desc: 'Heavy-duty exterior paint specialists are matched with commercial and residential building owners seeking verified, safety-compliant professionals.',
    },
    {
      title: 'Certified Electrical Safety Diagnostics',
      subtitle: 'Insulated Protection & Wiring Standards',
      image: electricianImg,
      badge: 'Electricians',
      badgeColor: 'bg-rose-500 text-white',
      desc: 'Equipped with professional safety gloves and high-voltage circuit diagnostic tools, electricians resolve critical power hazards and keep homes safe 24/7.',
    },
  ];

  const platformBenefits = [
    {
      icon: '🛡️',
      title: 'Dignity & Fair Compensation',
      desc: 'Workers set their own hourly rates and price proposals. No extortionate middleman brokerage or commission cuts.',
    },
    {
      icon: '⚡',
      title: 'Direct Client Connection',
      desc: 'Instant notifications when jobs open in your local radius. Direct chat and scheduling with homeowners.',
    },
    {
      icon: '🏅',
      title: 'Verified Badges & Trust Score',
      desc: 'NID-backed digital profiles with verified reviews that help skilled workers earn up to 3x more steady income.',
    },
    {
      icon: '📱',
      title: 'Transparent Digital Bookings',
      desc: 'Clear scope of work, photos of the repair area upfront, and guaranteed agreed prices before travel.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* ── Top Half Hero: alltype.png as Full-Bleed Panoramic Background ── */}
      <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden border-b border-gray-300 dark:border-gray-800">
        
        {/* Clear, High-Visibility Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={alltypeImg}
            alt="Karigor Artisans and City Life"
            className="w-full h-full object-cover object-center"
          />
          {/* Balanced cinematic scrim ensuring rich image visibility + crystal clear text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/60" />
        </div>

        {/* Hero Content on Top */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center space-y-6">
          
          {/* Big Dominant Brand Name in Cambria / Serif */}
          <h1 className="font-['Cambria',Georgia,serif] text-7xl sm:text-8xl lg:text-9xl font-black tracking-tight leading-none text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.9)] select-none">
            Karigor
          </h1>

          {/* Clean, Simple Tagline with High-Contrast Glow */}
          <p className="text-xl sm:text-2xl md:text-3xl text-emerald-300 font-bold max-w-3xl mx-auto leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
            Connect with trusted local service professionals
          </p>

          {/* Main Action Buttons (All pointing to /login for seamless flow) */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-5">
            {user ? (
              <Link
                to="/dashboard"
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 hover:scale-105 text-white font-black rounded-2xl shadow-2xl shadow-emerald-900/60 transition-all duration-200 text-lg flex items-center gap-2"
              >
                <span>Go to My Dashboard</span>
                <span>→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 hover:scale-105 text-white font-black rounded-2xl shadow-2xl shadow-emerald-900/60 transition-all duration-200 text-lg flex items-center gap-2"
                >
                  <span>Hire a Skilled Worker</span>
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-sky-500 hover:bg-sky-400 active:scale-95 hover:scale-105 text-white font-black rounded-2xl shadow-2xl shadow-sky-900/60 transition-all duration-200 text-lg flex items-center gap-2"
                >
                  <span>Join as a Pro Worker 🛠️</span>
                </Link>
              </>
            )}
            <Link
              to="/categories"
              className="px-8 py-4 bg-black/50 hover:bg-black/70 active:scale-95 hover:scale-105 text-white font-bold rounded-2xl border border-white/40 backdrop-blur-md transition-all duration-200 text-lg shadow-xl"
            >
              Browse Services
            </Link>
          </div>
        </div>
      </section>

      {/* Main Feature Section: "How We Are Good for Workers" */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Worker First Philosophy
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            How Karigor Creates Real Value for Workers
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            For decades, skilled blue-collar workers in Bangladesh faced unfair commission cuts, late payments, and zero social recognition. Karigor is engineered to change that reality.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformBenefits.map((b) => (
            <div
              key={b.title}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md hover:shadow-xl transition flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-4">
                  {b.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{b.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Gallery & Stories Showcase (Featuring All 5 Required Assets) */}
        <div className="space-y-8 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                Visual Showcase & Gallery
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                The Faces & Craft Behind Karigor
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              Real craftsmen with real skills transforming homes and building lasting careers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workerStories.map((story) => (
              <div
                key={story.title}
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-indigo-400 dark:hover:border-sky-500 transition duration-300 flex flex-col"
              >
                {/* Image Container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-md ${story.badgeColor}`}>
                      {story.badge}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                      {story.subtitle}
                    </span>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-sky-400 transition">
                      {story.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                      {story.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      ✓ Verified Skilled Pro
                    </span>
                    <Link
                      to="/login"
                      className="text-indigo-600 dark:text-sky-400 hover:underline font-semibold"
                    >
                      Book category →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action Banner (Pointing to /login) */}
        <div className="bg-gradient-to-r from-emerald-600 via-sky-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 max-w-xl text-center md:text-left">
            <h3 className="text-2xl sm:text-3xl font-black">
              Ready to experience dependable, trusted repairs?
            </h3>
            <p className="text-sm text-sky-100">
              Join thousands of satisfied households and verified workers on Karigor today.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/login"
              className="px-7 py-3.5 bg-white text-gray-900 hover:bg-gray-100 active:scale-95 hover:scale-105 font-bold rounded-2xl shadow-lg transition-all duration-200 text-sm"
            >
              Get Started as Customer
            </Link>
            <Link
              to="/login"
              className="px-7 py-3.5 bg-emerald-950/80 hover:bg-emerald-950 active:scale-95 hover:scale-105 text-white font-bold rounded-2xl border border-emerald-400/50 shadow-lg transition-all duration-200 text-sm"
            >
              Become a Worker
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-8 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Karigor (কারিগর)</span>
            <span>• Empowering Skilled Labor</span>
          </div>
          <div className="flex gap-6">
            <Link to="/home" className="hover:text-gray-900 dark:hover:text-white transition">Home</Link>
            <Link to="/categories" className="hover:text-gray-900 dark:hover:text-white transition">Categories</Link>
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
