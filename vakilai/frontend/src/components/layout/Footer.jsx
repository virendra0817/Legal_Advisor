import { Link } from "react-router-dom";
const Footer = () => (
  <footer className="bg-gray-900 text-gray-400">
    <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">VakilAI</span>
        </div>
        <p className="text-xs leading-relaxed">AI-powered legal information for India. Not a substitute for professional legal advice.</p>
      </div>
      {[
        { heading: "Product", links: [["Features","/#features"],["How it works","/#how"],["Pricing","/pricing"]] },
        { heading: "Legal",   links: [["Terms","/terms"],["Privacy","/privacy"],["Disclaimer","/disclaimer"]] },
        { heading: "Support", links: [["Help centre","/help"],["Contact","/contact"]] },
      ].map(col => (
        <div key={col.heading}>
          <p className="text-white text-xs font-medium mb-3">{col.heading}</p>
          <ul className="space-y-2">
            {col.links.map(([label, to]) => (
              <li key={label}><Link to={to} className="text-xs hover:text-white transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-gray-800 px-6 py-4 text-center text-xs">© 2025 VakilAI. All rights reserved.</div>
  </footer>
);
export default Footer;
