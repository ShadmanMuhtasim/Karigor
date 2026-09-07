import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Navbar } from '../components/Navbar';
import {
  ShieldCheckIcon,
  ZapIcon,
  MedalIcon,
  SmartphoneIcon,
  WrenchIcon,
  CheckCircleIcon,
  type IconProps,
} from '../components/icons/Icons';

// Assets
import workersInLineImg from '../assets/workers-in-line.jpg';
import plumberImg from '../assets/plumber_images.jpg';
import insidePainterImg from '../assets/inside-wall-painterimages.jpg';
import outsidePainterImg from '../assets/outside-wall-painterimages.jpg';
import electricianImg from '../assets/electrician-with-gloves.jpg';
import alltypeImg from '../assets/alltype.png';
import alltypeNightImg from '../assets/alltype_nightmode.png';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();

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

  const platformBenefits: {
    icon: React.ComponentType<IconProps>;
    title: string;
    desc: string;
  }[] = [
    {
      icon: ShieldCheckIcon,
      title: t('home.benefit1Title', 'Dignity & Fair Compensation'),
      desc: t('home.benefit1Desc', 'Workers set their own hourly rates and price proposals. No extortionate middleman brokerage or commission cuts.'),
    },
    {
      icon: ZapIcon,
      title: t('home.benefit2Title', 'Direct Client Connection'),
      desc: t('home.benefit2Desc', 'Instant notifications when jobs open in your local radius. Direct chat and scheduling with homeowners.'),
    },
    {
      icon: MedalIcon,
      title: t('home.benefit3Title', 'Verified Badges & Trust Score'),
      desc: t('home.benefit3Desc', 'NID-backed digital profiles with verified reviews that help skilled workers earn up to 3x more steady income.'),
    },
    {
      icon: SmartphoneIcon,
      title: t('home.benefit4Title', 'Transparent Digital Bookings'),
      desc: t('home.benefit4Desc', 'Clear scope of work, photos of the repair area upfront, and guaranteed agreed prices before travel.'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-200 flex flex-col">
      <Navbar />

      {/* ── Top Half Hero: alltype.png as Full-Bleed Panoramic Background ── */}
      <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden border-b border-gray-300 dark:border-gray-800">
        
        {/* Clear, High-Visibility Background Image with Smooth Theme Crossfade */}
        <div className="absolute inset-0 z-0">
          {/* Day / Light Mode Background */}
          <img
            src={alltypeImg}
            alt="Karigor Artisans and City Life - Day"
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ease-in-out ${
              theme === 'dark' ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {/* Night / Dark Mode Background */}
          <img
            src={alltypeNightImg}
            alt="Karigor Artisans and City Life - Night"
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ease-in-out ${
              theme === 'dark' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Balanced cinematic scrim ensuring rich image visibility + crystal clear text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/60" />
        </div>

        {/* Hero Content on Top */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28 text-center space-y-4 sm:space-y-6">
          
          {/* Big Dominant Brand Name in Cambria / Serif */}
          <h1 className="font-['Cambria',Georgia,serif] text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight leading-none text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.9)] select-none">
            {t('home.heroTitle', 'Karigor')}
          </h1>

          {/* Clean, Simple Tagline with High-Contrast Glow */}
          <p className="text-base sm:text-xl md:text-2xl lg:text-3xl text-emerald-300 font-bold max-w-3xl mx-auto leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] px-2">
            {t('home.heroTagline', 'Connect with trusted local service professionals')}
          </p>

          {/* Main Action Buttons (Responsive stacking on mobile) */}
          <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto w-full">
            {user ? (
              <Link
                to="/dashboard"
                className="btn-press w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl shadow-2xl shadow-emerald-900/60 text-base sm:text-lg flex items-center justify-center gap-2"
              >
                <span>{t('home.goToDashboard', 'Go to My Dashboard')}</span>
                <span>→</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn-press w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-2xl shadow-2xl shadow-emerald-900/60 text-base sm:text-lg flex items-center justify-center gap-2"
                >
                  <span>{t('home.findSkilledArtisan', 'Find a Skilled Artisan')}</span>
                </Link>
                <Link
                  to="/login"
                  className="btn-press w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-sky-500 hover:bg-sky-400 text-white font-black rounded-2xl shadow-2xl shadow-sky-900/60 text-base sm:text-lg flex items-center justify-center gap-2"
                >
                  <span>{t('home.becomeWorker', 'Register as a Worker')}</span>
                  <WrenchIcon className="w-5 h-5 text-white" />
                </Link>
              </>
            )}
            <Link
              to="/categories"
              className="btn-press w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-black/50 hover:bg-black/70 text-white font-bold rounded-2xl border border-white/40 backdrop-blur-md text-base sm:text-lg shadow-xl flex items-center justify-center text-center"
            >
              {t('home.categoriesLink', 'Browse Trades')}
            </Link>
          </div>
        </div>
      </section>

      {/* Main Feature Section: "How We Are Good for Workers" */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {t('home.heroTitle', 'Karigor')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            {t('home.benefitsTitle', 'Why Karigor?')}
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {t('home.benefitsSubtitle', 'A platform built on fairness, dignity, and real-time reliability.')}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformBenefits.map((b) => (
            <div
              key={b.title}
              className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-sky-400 flex items-center justify-center mb-4">
                  <b.icon className="w-6 h-6" />
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
                {t('home.heroTitle', 'Karigor')}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
                {t('home.storiesTitle', 'Real Craftsmen, Real Respect')}
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              {t('home.storiesSubtitle', "Empowering Bangladesh's Skilled Trades with Digital Trust")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workerStories.map((story) => (
              <div
                key={story.title}
                className="card-lift group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-lg hover:border-indigo-400 dark:hover:border-sky-500 flex flex-col"
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
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>{t('nav.worker', 'Artisan')}</span>
                    </span>
                    <Link
                      to="/login"
                      className="text-indigo-600 dark:text-sky-400 hover:underline font-semibold"
                    >
                      {t('home.categoriesLink', 'Browse Trades')} →
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
              {t('home.benefitsTitle', 'Why Karigor?')}
            </h3>
            <p className="text-sm text-sky-100">
              {t('home.footerTagline', 'Karigor is Bangladesh’s premier artisan-first local service marketplace.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/login"
              className="btn-press px-7 py-3.5 bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-2xl shadow-lg text-sm"
            >
              {t('home.findSkilledArtisan', 'Find a Skilled Artisan')}
            </Link>
            <Link
              to="/login"
              className="btn-press px-7 py-3.5 bg-emerald-950/80 hover:bg-emerald-950 text-white font-bold rounded-2xl border border-emerald-400/50 shadow-lg text-sm"
            >
              {t('home.becomeWorker', 'Register as a Worker')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-8 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Karigor (কারিগর)</span>
            <span>• {t('home.copyright', 'Dedicated to the dignity of skilled labor in Bangladesh.')}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/home" className="hover:text-gray-900 dark:hover:text-white transition">{t('nav.home', 'Home')}</Link>
            <Link to="/categories" className="hover:text-gray-900 dark:hover:text-white transition">{t('nav.categories', 'Categories')}</Link>
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition">{t('nav.signIn', 'Sign In')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
