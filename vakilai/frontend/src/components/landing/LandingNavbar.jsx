import { Link } from "react-router-dom";
const LandingNavbar = () => (
  <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75"/>
          </svg>
        </div>
        <span className="text-base font-semibold text-gray-900">VakilAI</span>
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
        <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
        <a href="#how"      className="hover:text-gray-900 transition-colors">How it works</a>
        <a href="#categories" className="hover:text-gray-900 transition-colors">Legal areas</a>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors">Log in</Link>
        <Link to="/register" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors">
          Get started free
        </Link>
      </div>
    </div>
  </nav>
);
export default LandingNavbar;
