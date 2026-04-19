import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import RegistrationPortal from './pages/RegistrationPortal'
import Explorer from './pages/Explorer'
import AgentDemo from './pages/AgentDemo'
import { Wallet, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'

function NavLink({ to, children }: { to: string, children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        isActive 
          ? 'bg-blue-50 text-blue-700 shadow-sm' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  )
}

function shortAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function Layout() {
  const [walletAddress, setWalletAddress] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('tourskill_wallet_address')
    if (saved) setWalletAddress(saved)
  }, [])

  const connectWallet = async () => {
    try {
      const eth = (window as Window & { ethereum?: unknown }).ethereum
      if (!eth) {
        alert('Please install MetaMask first.')
        return
      }
      const provider = new BrowserProvider(eth as any)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      setWalletAddress(address)
      localStorage.setItem('tourskill_wallet_address', address)
      window.dispatchEvent(new Event('tourskill:wallet-changed'))
    } catch (error) {
      console.error(error)
      alert('Failed to connect wallet.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      {/* Premium Glassmorphism Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-10">
              <Link to="/" className="flex items-center space-x-2 group">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
                  TourSkill
                </span>
              </Link>
              
              <nav className="hidden md:flex items-center p-1 space-x-1 bg-slate-100/50 rounded-full border border-slate-200/50">
                <NavLink to="/register">Registration</NavLink>
                <NavLink to="/explorer">Explorer</NavLink>
                <NavLink to="/demo">Agent Demo</NavLink>
              </nav>
            </div>
            
            <div className="flex items-center">
              <button
                onClick={connectWallet}
                className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 ring-1 ring-slate-900/5"
              >
                <Wallet className="w-4 h-4" />
                <span>{walletAddress ? shortAddress(walletAddress) : 'Connect Wallet'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full relative">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegistrationPortal />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/demo" element={<AgentDemo />} />
        </Routes>
      </main>
      
      {/* Simple elegant footer */}
      <footer className="border-t border-slate-200/60 bg-white/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500 font-medium">
            © 2026 TourSkill Registry. 0G APAC Hackathon.
          </p>
          <div className="flex space-x-6">
            <span className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">Protocol</span>
            <span className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">Docs</span>
            <span className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

export default App
