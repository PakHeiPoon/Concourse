import { Link } from 'react-router-dom'
import { Store, Globe, Bot, ArrowRight, Code2, ShieldCheck, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center pt-10 pb-24 relative w-full overflow-hidden">
      
      {/* Decorative background gradients */}
      <div className="absolute top-0 -left-40 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />
      <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />

      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-20 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center space-x-2 bg-blue-50/80 border border-blue-100 px-4 py-1.5 rounded-full text-blue-700 text-sm font-semibold tracking-wide backdrop-blur-sm shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span>0G Network Testnet Live</span>
        </div>
        
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tighter text-slate-900 leading-[1.1]">
          Decentralized AI <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
            Yellow Pages
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-light">
          A global registry connecting tourism merchants with personal AI agents via standard MCP/A2A protocols.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-full font-semibold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center group">
            <span>Register Merchant</span>
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/demo" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 rounded-full font-semibold shadow-md border border-slate-200 hover:border-slate-300 hover:text-slate-900 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center">
            <Bot className="mr-2 w-5 h-5 text-indigo-500" />
            <span>Try Agent Demo</span>
          </Link>
        </div>
      </div>
      
      {/* Feature Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto z-10 relative">
        
        <Link to="/register" className="group relative bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="bg-blue-100/50 text-blue-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ring-1 ring-blue-200/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 relative z-10">
            <Store size={26} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight relative z-10">For Merchants</h2>
          <p className="text-slate-500 leading-relaxed relative z-10 flex-grow font-medium">
            Register your hotel, restaurant, or attraction on the 0G blockchain. Make your services discoverable to global AI agents instantly with no coding required.
          </p>
          <div className="mt-8 flex items-center text-blue-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all relative z-10">
            <span>Get listed now</span>
            <ArrowRight size={16} />
          </div>
        </Link>
        
        <Link to="/explorer" className="group relative bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="bg-emerald-100/50 text-emerald-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ring-1 ring-emerald-200/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 relative z-10">
            <Globe size={26} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight relative z-10">For Travelers</h2>
          <p className="text-slate-500 leading-relaxed relative z-10 flex-grow font-medium">
            Explore the decentralized registry. Browse the rich, structured data that empowers personal AI agents to construct your perfect, tailored itinerary.
          </p>
          <div className="mt-8 flex items-center text-emerald-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all relative z-10">
            <span>Explore directory</span>
            <ArrowRight size={16} />
          </div>
        </Link>

        <Link to="/demo" className="group relative bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 overflow-hidden flex flex-col h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="bg-violet-100/50 text-violet-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 ring-1 ring-violet-200/50 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 relative z-10">
            <Bot size={26} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight relative z-10">For Personal Agents</h2>
          <p className="text-slate-500 leading-relaxed relative z-10 flex-grow font-medium">
            Watch how a personal AI agent queries the registry, discovers merchants, and invokes skills based on specific user preferences and dietary constraints.
          </p>
          <div className="mt-8 flex items-center text-violet-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all relative z-10">
            <span>See it in action</span>
            <ArrowRight size={16} />
          </div>
        </Link>
      </div>

      {/* Tech Highlights */}
      <div className="mt-32 w-full max-w-5xl mx-auto border-t border-slate-200/60 pt-16 flex flex-col md:flex-row justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
        <div className="flex items-center gap-3">
          <Code2 className="text-slate-700 w-6 h-6" />
          <span className="text-slate-700 font-semibold tracking-wide">MCP / A2A Compatible</span>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-slate-700 w-6 h-6" />
          <span className="text-slate-700 font-semibold tracking-wide">ERC-8004 Verified</span>
        </div>
        <div className="flex items-center gap-3">
          <Zap className="text-slate-700 w-6 h-6" />
          <span className="text-slate-700 font-semibold tracking-wide">0G Network Powered</span>
        </div>
      </div>
    </div>
  )
}
