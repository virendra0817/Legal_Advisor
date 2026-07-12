import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", title: "AI Legal Consultation", desc: "Two-way conversational guidance from an AI trained on Indian law, structured like a real intake session." },
  { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: "Document Analysis", desc: "Upload your PDF, DOCX, or TXT documents. Get a structured breakdown of clauses, parties, risks, and obligations." },
  { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", title: "RAG-Powered Search", desc: "Answers grounded in your uploaded documents and a curated Indian legal knowledge base — never fabricated." },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Chat History", desc: "Every consultation is saved. Search, revisit, and continue any past conversation at any time." },
  { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", title: "Confidence Scoring", desc: "Every AI response includes a confidence level and cites the specific context it drew from." },
  { icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129", title: "Hindi & Regional", desc: "Documents in Devanagari, Tamil, Telugu, Bengali, and more are detected and handled appropriately." },
];

const CATEGORIES = [
  { slug: "tenant-landlord", label: "Tenant & Landlord", icon: "🏠", desc: "Deposit disputes, eviction, rent hikes, repair obligations" },
  { slug: "consumer",        label: "Consumer Rights",   icon: "🛒", desc: "Product defects, refunds, service failures, COPRA complaints" },
  { slug: "employment",      label: "Employment",        icon: "💼", desc: "Wrongful termination, unpaid dues, harassment, notice period" },
  { slug: "criminal",        label: "FIR & Criminal",    icon: "⚖️", desc: "FIR filing, bail, Section 498A, cybercrime, cheque bounce" },
  { slug: "family",          label: "Family Law",        icon: "👨‍👩‍👧", desc: "Divorce, maintenance, custody, domestic violence, succession" },
  { slug: "property",        label: "Property & RERA",   icon: "🏗️", desc: "Sale deed, RERA complaints, builder disputes, title issues" },
];

const STEPS = [
  { n: "1", title: "Describe your issue", desc: "Tell VakilAI what's happening in plain language. Upload any relevant documents." },
  { n: "2", title: "AI gathers the facts", desc: "VakilAI asks targeted follow-up questions and analyses your documents to understand your situation fully." },
  { n: "3", title: "Get grounded guidance", desc: "Receive structured legal information with cited sources, applicable statutes, risks, and concrete next steps." },
];

const LandingPage = () => (
  <div>
    {/* Hero */}
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0ibTM2IDM0djZoNnYtNnptLTMwIDB2NmgzNnYtNnpNMzYgMjh2NmgtNnYtNnptLTMwIDB2Nmg2di02em0wLTZ2Nmg2VjIyem0zMCAwdjZoNlYyMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"/>
      <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 text-sm mb-8">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
          Legal guidance for 1.4 billion Indians
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
          Your AI Legal Consultant<br/>
          <span className="text-indigo-300">Powered by Indian Law</span>
        </h1>
        <p className="text-lg text-indigo-200 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload your rent agreement, FIR, employment contract, or legal notice. Ask questions in plain language.
          Get grounded, cited guidance — the way a real consultant would give it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register"
            className="px-8 py-3.5 bg-white text-indigo-700 font-medium rounded-xl hover:bg-indigo-50 transition-colors text-sm">
            Start free consultation
          </Link>
          <a href="#how"
            className="px-8 py-3.5 border border-white/30 text-white font-medium rounded-xl hover:bg-white/10 transition-colors text-sm">
            See how it works
          </a>
        </div>
        <p className="text-xs text-indigo-300 mt-6">Legal information only — not a substitute for professional legal advice</p>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Everything you need to understand your legal situation</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">Built specifically for the Indian legal system — IPC, CrPC, RERA, Consumer Protection Act, and more.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-4.5 h-4.5 text-indigo-600 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon}/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works */}
    <section id="how" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">How VakilAI works</h2>
          <p className="text-gray-500 text-sm">A structured intake process — the way a real legal consultant operates.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative text-center">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-6 left-1/2 w-full h-px bg-indigo-100"/>
              )}
              <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg mb-4">
                {s.n}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Categories */}
    <section id="categories" className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Legal areas covered</h2>
          <p className="text-gray-500 text-sm">Specialised knowledge for the most common legal situations Indian users face.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(c => (
            <Link key={c.slug} to={`/register?category=${c.slug}`}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
              <div className="text-2xl mb-3">{c.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">{c.label}</h3>
              <p className="text-xs text-gray-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 bg-indigo-600">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Get legal clarity today — free</h2>
        <p className="text-indigo-200 text-sm mb-8">No hidden costs. No jargon. Just grounded, cited legal information built for India.</p>
        <Link to="/register"
          className="inline-block px-8 py-3.5 bg-white text-indigo-700 font-medium rounded-xl hover:bg-indigo-50 transition-colors text-sm">
          Create free account
        </Link>
      </div>
    </section>

    {/* Disclaimer */}
    <div className="bg-amber-50 border-t border-amber-200 px-6 py-4 text-center text-xs text-amber-700">
      VakilAI provides general legal information, not legal advice, and is not a substitute for consulting a licensed advocate. Information is based on Indian law and may not account for state-specific variations.
    </div>
  </div>
);
export default LandingPage;
