import { Outlet, Link } from "react-router-dom";
const AuthLayout = () => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
    <div className="flex items-center px-6 py-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971z"/>
          </svg>
        </div>
        <span className="text-lg font-semibold text-gray-900">VakilAI</span>
      </Link>
    </div>
    <div className="flex-1 flex items-center justify-center px-4 py-12"><Outlet /></div>
    <p className="text-center text-xs text-gray-400 pb-6">VakilAI provides legal information, not legal advice. © 2025</p>
  </div>
);
export default AuthLayout;
