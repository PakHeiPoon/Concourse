import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Terminal, Sparkles, CheckCircle2, Navigation, Activity, RotateCcw, Wallet, Loader2, AlertCircle } from 'lucide-react'
import { use0gCompute, NETWORKS, type NetworkType } from '../hooks/use0gCompute'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface LogEntry {
  time: string
  text: string
  type: 'info' | 'action' | 'success' | 'error'
}

export default function AgentDemo() {
  const { ready, model, provider, network: connectedNetwork, error: computeError, loading: computeLoading, step, connect, chat } = use0gCompute()

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('testnet')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type,
    }])
  }

  const handleConnect = async () => {
    await connect(selectedNetwork, addLog)
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !ready) return
    const userMsg = input.trim()
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    addLog(`User: "${userMsg}"`, 'info')

    try {
      const reply = await chat(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        (entry) => {
          const logType: LogEntry['type'] =
            entry.type === 'tool_call' ? 'action' :
            entry.type === 'tool_result' ? 'success' :
            entry.type === 'error' ? 'error' : 'info'
          const logText =
            entry.type === 'tool_call' ? `Tool Call: ${entry.name}(${JSON.stringify(entry.args)})` :
            entry.type === 'tool_result' ? `Result [${entry.name}]: ${entry.text}` :
            entry.text || ''
          addLog(logText, logType)
        },
      )

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      addLog('Agent responded', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addLog(`Error: ${msg}`, 'error')
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, an error occurred: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setLogs([])
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Bot className="w-8 h-8 text-indigo-600" />
            Personal Agent Demo
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Connect your wallet to use 0G Compute LLM — your tokens power the AI agent.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Connection Status Bar */}
      {!ready && (
        <div className="mb-6 p-4 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Connect to 0G Compute Network</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your MetaMask wallet pays for LLM inference with 0G tokens — fully decentralized.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {/* Network Selector */}
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value as NetworkType)}
                  disabled={computeLoading}
                  className="text-sm font-medium border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                >
                  {Object.entries(NETWORKS).map(([key, net]) => (
                    <option key={key} value={key}>{net.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleConnect}
                  disabled={computeLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  {computeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </>
                  )}
                </button>
              </div>
              {step && (
                <span className="text-xs text-indigo-500 font-medium animate-pulse">{step}</span>
              )}
            </div>
          </div>
          {computeError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-rose-600 bg-rose-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{computeError}</span>
            </div>
          )}
        </div>
      )}

      {ready && (
        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200/60 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">Connected to 0G Compute · {NETWORKS[connectedNetwork || 'testnet'].name}</p>
            <p className="text-xs text-emerald-600 font-mono">
              Model: {model} · Provider: {provider?.slice(0, 8)}...{provider?.slice(-4)}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-[700px]">
        {/* Chat Interface */}
        <div className="lg:col-span-3 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="p-5 border-b border-slate-200/60 bg-white/50 flex items-center justify-between z-10 relative">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 ${ready ? 'bg-green-500' : 'bg-slate-400'} border-2 border-white rounded-full`}></div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">TourSkill AI Agent</h3>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${ready ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'} px-2 py-0.5 rounded-full w-fit mt-0.5`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {ready ? `0G Compute · ${model}` : 'Not Connected'}
                </div>
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth z-10 relative">
            {!ready && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                <Wallet className="w-12 h-12 opacity-40" />
                <div className="text-center">
                  <p className="font-medium text-slate-500">Connect your wallet to start</p>
                  <p className="text-sm mt-1">Your 0G tokens power the AI inference</p>
                </div>
              </div>
            )}
            {ready && messages.length === 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-4 text-[15px] leading-relaxed shadow-sm bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm">
                  <p>Hello! I'm your AI travel assistant powered by <strong className="text-slate-900 font-bold">0G Compute Network</strong> and the <strong className="text-slate-900 font-bold">TourSkill</strong> decentralized registry.</p>
                  <p className="mt-3">I can discover tourism merchants and interact with their on-chain skills. Try asking me:</p>
                  <p className="ml-3 mt-1 flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span><span>"Find restaurants in Hangzhou"</span></p>
                  <p className="ml-3 mt-1 flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span><span>"Any hotels in Shanghai?"</span></p>
                  <p className="ml-3 mt-1 flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span><span>"Show me attractions in Suzhou"</span></p>
                  <p className="mt-3">What are you looking for?</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 text-[15px] leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                }`}>
                  {m.content.split('\n').map((line, j) => {
                    if (line.startsWith('```')) return null
                    if (line.startsWith('- ')) {
                      const formatted = line.slice(2).split('**').map((part, k) =>
                        k % 2 === 1 ? <strong key={k} className={m.role === 'user' ? 'text-white font-bold' : 'text-slate-900 font-bold'}>{part}</strong> : part
                      )
                      return <p key={j} className="ml-3 mt-1 flex items-start gap-1.5"><span className="text-indigo-400 mt-0.5">•</span><span>{formatted}</span></p>
                    }
                    return (
                      <p key={j} className={j > 0 ? "mt-3" : ""}>
                        {line.includes('**')
                          ? line.split('**').map((part, k) => k % 2 === 1 ? <strong key={k} className={m.role === 'user' ? 'text-white font-bold' : 'text-slate-900 font-bold'}>{part}</strong> : part)
                          : line.includes('`')
                            ? line.split('`').map((part, k) => k % 2 === 1 ? <code key={k} className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono">{part}</code> : part)
                            : line}
                      </p>
                    )
                  })}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 text-slate-700 p-4 rounded-2xl rounded-tl-sm flex space-x-1.5 items-center shadow-sm">
                  <div className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white/80 border-t border-slate-200/60 z-10 relative">
            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={!ready}
                className="flex-1 max-h-32 min-h-[44px] bg-transparent px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none disabled:opacity-50"
                placeholder={ready ? "Ask about restaurants, hotels, attractions..." : "Connect your wallet first..."}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !ready}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-all flex items-center justify-center shrink-0 mb-0.5 mr-0.5 shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[11px] text-slate-400 font-medium">
                {ready
                  ? `Powered by 0G Compute · ${model} · Your wallet pays for inference`
                  : 'Connect MetaMask to power the AI agent with your 0G tokens'}
              </span>
            </div>
          </div>
        </div>

        {/* Execution Logs Terminal */}
        <div className="lg:col-span-2 bg-[#0A0A0A] rounded-3xl shadow-xl border border-slate-800 flex flex-col overflow-hidden relative">
          {/* Terminal Header */}
          <div className="px-4 py-3 bg-[#111111] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Agent Execution Logs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`${ready ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full ${ready ? 'bg-emerald-400' : 'bg-slate-600'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${ready ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
              </span>
              <span className={`text-[10px] font-mono ${ready ? 'text-emerald-500' : 'text-slate-600'}`}>
                {ready ? '0G Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Terminal Body */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-[13px] leading-relaxed space-y-3 scroll-smooth">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                <span className={`break-words ${
                  log.type === 'action' ? 'text-indigo-400' :
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-rose-400' :
                  'text-slate-300'
                }`}>
                  {log.type === 'action' && <Navigation className="inline w-3 h-3 mr-1.5 -mt-0.5" />}
                  {log.type === 'success' && <CheckCircle2 className="inline w-3 h-3 mr-1.5 -mt-0.5" />}
                  {log.type === 'info' && <Activity className="inline w-3 h-3 mr-1.5 -mt-0.5" />}
                  {log.text}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-600 flex flex-col items-center justify-center h-full space-y-3 opacity-50">
                <Terminal className="w-8 h-8" />
                <p>Connect wallet to see agent activity...</p>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
