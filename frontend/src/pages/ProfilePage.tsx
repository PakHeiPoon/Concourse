import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Store,
  Bot,
  ArrowRight,
  ShieldCheck,
  Loader2,
  PlusCircle,
} from 'lucide-react'
import { useT } from '../i18n'
import { getAgentsByOwner, fetchAndHashCard } from '../lib/erc8004'
import InstallCredentialsCard from '../components/InstallCredentialsCard'

const CHAINSCAN_ADDRESS = 'https://sepolia.basescan.org/address'
const CHAIN_ID = 84532
const CHAIN_NAME = 'Base Sepolia'

const INSTALL_PROMPT = 'Install the Concourse skill from https://concourse.paking.xyz/skills/user-client/SKILL.md'
const SKILL_URL = 'https://concourse.paking.xyz/skills/user-client/SKILL.md'

// "My merchants" reads straight from the ERC-8004 IdentityRegistry on Base —
// whatever this wallet registered on-chain shows up here, with no backend
// indexer in the path. Each owned agentId's card is fetched and SHA-256
// verified against the on-chain commit.
interface OwnedAgent {
  agentId:    number
  name:       { en: string; zh: string }
  type:       string
  city:       string
  skillCount: number
  cardURI:    string
  verified:   boolean
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch { /* ignore */ }
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-primary hover:bg-primary-soft transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function typeBadge(type: string): string {
  switch (type) {
    case 'hotel':      return 'bg-primary-soft text-primary border-primary/20'
    case 'restaurant': return 'bg-accent-soft text-accent border-accent/20'
    default:           return 'bg-emerald-50 text-emerald-700 border-emerald-100/60'
  }
}

export default function ProfilePage(): React.JSX.Element {
  const { t, lang } = useT()
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [merchants, setMerchants] = useState<OwnedAgent[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [installCopied, setInstallCopied] = useState<boolean>(false)

  // Sync wallet from localStorage + listen for header changes
  useEffect(() => {
    const sync = () => setWalletAddress(localStorage.getItem('concourse_wallet_address') ?? '')
    sync()
    window.addEventListener('concourse:wallet-changed', sync)
    return () => window.removeEventListener('concourse:wallet-changed', sync)
  }, [])

  // Read agents this wallet owns straight from the chain, then fetch + verify
  // each one's card for display. No backend, no indexer.
  useEffect(() => {
    if (!walletAddress) {
      setMerchants([])
      return
    }
    let cancelled = false
    setLoading(true)
    getAgentsByOwner(walletAddress)
      .then(async (agents) => {
        const active = agents.filter((a) => a.active)
        const rows = await Promise.all(
          active.map(async (a): Promise<OwnedAgent> => {
            try {
              const { card, hash } = await fetchAndHashCard(a.agentCardURI)
              const ext = (card.extensions ?? {}) as Record<string, Record<string, unknown>>
              const i18n = ext['tourskill.org/v1/i18n']
              const loc = ext['tourskill.org/v1/location']
              const merch = ext['tourskill.org/v1/merchant']
              const name = (i18n?.name as { en: string; zh: string } | undefined)
                ?? { en: card.name, zh: card.name }
              return {
                agentId:    a.agentId,
                name,
                type:       (merch?.type as string) ?? '',
                city:       (loc?.city as string) ?? '',
                skillCount: card.skills?.length ?? 0,
                cardURI:    a.agentCardURI,
                verified:   hash.toLowerCase() === a.agentCardHash.toLowerCase(),
              }
            } catch {
              // Card unreachable / unparseable — still show the on-chain entry.
              return {
                agentId:    a.agentId,
                name:       { en: `Agent #${a.agentId}`, zh: `Agent #${a.agentId}` },
                type:       '',
                city:       '',
                skillCount: 0,
                cardURI:    a.agentCardURI,
                verified:   false,
              }
            }
          }),
        )
        if (!cancelled) setMerchants(rows)
      })
      .catch(() => { if (!cancelled) setMerchants([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [walletAddress])

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_PROMPT)
      setInstallCopied(true)
      window.setTimeout(() => setInstallCopied(false), 2000)
    } catch { /* ignore */ }
  }

  // ───── Disconnected state ─────
  if (!walletAddress) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-soft items-center justify-center mb-6">
          <Wallet className="w-8 h-8 text-primary" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">{t('profile.connectWallet.title')}</h1>
        <p className="text-text-muted mb-6">{t('profile.connectWallet.body')}</p>
        <p className="text-sm text-text-muted">{t('profile.connectWallet.hint')}</p>
      </div>
    )
  }

  // ───── Connected state ─────
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Identity card */}
      <section className="bg-white rounded-3xl border border-border shadow-sm p-8 mb-6">
        <div className="flex items-start gap-5 mb-6">
          {/* Big gradient avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/20 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text mb-1">{t('profile.wallet.title')}</h1>
            <div className="flex items-center gap-2 mb-3">
              <code className="text-sm font-mono text-text-muted break-all">{walletAddress}</code>
              <CopyButton value={walletAddress} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-soft border border-primary/30 rounded-md text-xs font-semibold text-primary">
                <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                {CHAIN_NAME}
              </span>
              <span className="px-2.5 py-1 bg-surface text-text-muted text-xs font-medium rounded-md border border-border">
                chainId {CHAIN_ID}
              </span>
              <a
                href={`${CHAINSCAN_ADDRESS}/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium ml-auto"
              >
                {t('profile.wallet.viewChainscan')}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Install to your agent */}
      <div className="mb-6">
        <InstallCredentialsCard wallet={walletAddress} />
      </div>

      {/* My Merchants */}
      <section className="bg-white rounded-3xl border border-border shadow-sm p-8 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Store className="w-5 h-5 text-text-muted" />
            {t('profile.merchants.title')}
            {merchants.length > 0 && (
              <span className="text-sm text-text-muted font-normal">· {merchants.length}</span>
            )}
          </h2>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            {t('profile.merchants.registerNew')}
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {t('common.loading')}
          </div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <Store className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
            <p className="text-text-muted text-sm mb-4">
              {t('profile.merchants.empty')}
            </p>
            <Link
              to="/register"
              className="text-primary hover:text-primary-hover text-sm font-semibold inline-flex items-center gap-1"
            >
              {t('profile.merchants.emptyCta')}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {merchants.map(m => {
              const cityCap = m.city ? m.city.charAt(0).toUpperCase() + m.city.slice(1) : ''
              return (
                <a
                  key={m.agentId}
                  href={m.cardURI}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 p-4 rounded-xl border bg-surface border-border hover:border-primary/40 hover:bg-white transition-all"
                >
                  {m.type && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border shrink-0 ${typeBadge(m.type)}`}>
                      {m.type}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-semibold truncate text-text group-hover:text-primary transition-colors">
                        {m.name?.[lang as 'en' | 'zh'] || m.name.en}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border shrink-0 ${
                          m.verified
                            ? 'bg-primary-soft text-primary border-primary/30'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                        title={m.verified ? 'SHA-256 matches the on-chain commit' : 'card hash mismatch'}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" strokeWidth={3} />
                        {m.verified ? 'verified' : 'unverified'} · #{m.agentId}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted truncate mt-0.5">
                      {cityCap}{cityCap && ' · '}{m.skillCount} skills
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted/50 group-hover:text-primary shrink-0 mt-0.5" />
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* Connect your AI agent */}
      <section className="bg-white rounded-3xl border border-border shadow-sm p-8">
        <h2 className="text-lg font-bold text-text flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-primary" />
          {t('profile.agent.title')}
        </h2>
        <p className="text-sm text-text-muted mb-4">
          {t('profile.agent.body')}
        </p>

        <pre className="bg-text rounded-lg p-4 text-sm font-mono leading-relaxed overflow-x-auto mb-3">
          <code className="text-slate-300">Install the Concourse skill from{'\n'}</code>
          <a
            href={SKILL_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary-soft hover:text-white break-all underline-offset-4 hover:underline"
          >
            {SKILL_URL}
          </a>
        </pre>

        <button
          onClick={copyInstall}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition-colors text-sm"
        >
          {installCopied ? (
            <>
              <Check className="w-4 h-4" />
              {t('profile.agent.copied')}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {t('profile.agent.copyButton')}
            </>
          )}
        </button>
      </section>
    </div>
  )
}
