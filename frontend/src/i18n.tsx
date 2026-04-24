import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'

const STORAGE_KEY = 'tourskill_lang'

// Flat translation dict. Keys use dotted namespacing.
const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  en: {
    // ─── Header ───
    'nav.registration': 'Registration',
    'nav.explorer': 'Explorer',
    'nav.demo': 'Agent Demo',
    'header.connect': 'Connect Wallet',
    'header.profile': 'View Profile',
    'header.disconnect': 'Disconnect',
    'header.connectedAs': 'Connected as',

    // ─── Footer ───
    'footer.copy': '© 2026 TourSkill. The Decentralized A2A Tourism Registry.',
    'footer.contract': 'Contract',
    'footer.skillMd': 'SKILL.md',
    'footer.github': 'GitHub',

    // ─── Home: live badge ───
    'home.liveBadge': '28 merchants live on 0G testnet',

    // ─── Home: hero ───
    'home.hero.line1': 'The Decentralized',
    'home.hero.line2': 'A2A Tourism Registry',
    'home.hero.subtitle.before': "Your agent talks to their agent. No OTA, no middleman. Every merchant bound to a real wallet, every call settled via ",
    'home.hero.subtitle.highlight': 'x402 micropayments',
    'home.hero.subtitle.after': ' at the HTTP layer.',

    // ─── Home: CTAs ───
    'home.cta.human': "I'm Human",
    'home.cta.agent': "I'm an Agent",
    'home.cta.noAgent.before': "Don't have an AI agent? ",
    'home.cta.noAgent.link': 'Try the web demo',

    // ─── Home: install card ───
    'home.install.tab.personal': 'Personal Agent',
    'home.install.tab.merchant': 'Merchant Agent',
    'home.install.title.personal': 'Send your AI agent to TourSkill',
    'home.install.title.merchant': 'Bring your merchant agent to TourSkill',
    'home.install.copy': 'Copy',
    'home.install.copied': 'Copied',
    // Personal agent flow
    'home.install.personal.step1': 'Paste this to your personal agent (Claude Code, Cursor, or any AI that can load skills)',
    'home.install.personal.step2': 'The agent fetches the SKILL.md — no auth needed, no local backend to run',
    'home.install.personal.step3.before': 'Ask it ',
    'home.install.personal.step3.example': '"find me dinner in Hangzhou tomorrow"',
    'home.install.personal.step3.after': ' — watch A2A commerce happen',
    // Merchant agent flow
    'home.install.merchant.step1': 'Paste this to your business owner\'s AI agent — the one that knows your shop',
    'home.install.merchant.step2': 'The agent drafts your profile, you confirm, then sign once via MetaMask to anchor on-chain',
    'home.install.merchant.step3.before': 'Later, just say ',
    'home.install.merchant.step3.example': '"update my opening hours"',
    'home.install.merchant.step3.after': ' — daily edits never require signing',

    // ─── Home: three pillars ───
    'home.pillar1.title': 'On-chain Identity',
    'home.pillar1.body': 'Every merchant anchored on 0G Chain via ERC-8004. Identity is verifiable, portable, sovereign — no platform can de-list you.',
    'home.pillar2.title': 'x402 Native',
    'home.pillar2.body': 'The first A2A registry with payment baked into HTTP. Agent pays agent at the edge, no take-rate, no 30% OTA margin.',
    'home.pillar3.title': 'MCP / A2A Compatible',
    'home.pillar3.body': 'Standard tool interface — any AI agent that speaks MCP can discover, verify, and transact. Zero custom SDK.',

    // ─── Home: AgentLoopDemo ───
    'demo.badge': 'Live demo · no real charges',
    'demo.title': 'Watch your agent work',
    'demo.subtitle': 'Four HTTP calls. One on-chain receipt. No platform in between.',
    'demo.terminalLabel.running': 'running',
    'demo.terminalLabel.idle': 'idle',
    'demo.replay': 'Replay',
    'demo.restartSoon': '── replays in a few seconds ──',
    'demo.cta.before': 'Want to actually try it? ',
    'demo.cta.link': 'Install the skill →',

    // ─── Roadmap ───
    'roadmap.badge': 'Roadmap',
    'roadmap.title': "What's shipped, what's next",
    'roadmap.subtitle': 'Open registry · merchant agents · payments · reputation. Built in the open.',
    'roadmap.status.live': 'Live',
    'roadmap.status.building': 'Building',
    'roadmap.status.planned': 'Planned',

    // ─── Explorer ───
    'explorer.title': 'Registry Explorer',
    'explorer.subtitle': 'Discover merchants and their on-chain AI Skills available on the network.',
    'explorer.cityAll': 'All Cities Globally',
    'explorer.agentSkills': 'Available Agent Skills',
    'explorer.testSkillApi': 'Test Skill API',
    'explorer.emptyTitle': 'No Merchants Found',
    'explorer.emptyBody': 'There are no registered merchants in the selected city yet.',

    // ─── Status badges ───
    'status.active': 'Open for business',
    'status.inactive': 'Paused',

    // ─── Profile page ───
    'profile.connectWallet.title': 'Connect your wallet',
    'profile.connectWallet.body': 'Sign in with your wallet to view your TourSkill profile, manage your registered merchants, and connect your AI agent.',
    'profile.connectWallet.hint': 'Use the Connect Wallet button in the top right →',
    'profile.wallet.title': 'Wallet Profile',
    'profile.wallet.viewChainscan': 'View on chainscan',
    'profile.merchants.title': 'My Merchants',
    'profile.merchants.registerNew': 'Register new',
    'profile.merchants.empty': 'No merchants registered with this wallet yet.',
    'profile.merchants.emptyCta': 'Register your first merchant',
    'profile.merchants.pause': 'Pause',
    'profile.merchants.resume': 'Resume',
    'profile.merchants.updating': 'Updating…',
    'profile.merchants.toggleError': 'Could not toggle status — check your connection and try again.',
    'profile.agent.title': 'Connect your AI Agent',
    'profile.agent.body': 'Send this one-line install prompt to your personal AI agent. It will fetch the TourSkill SKILL.md and immediately start interacting with the on-chain registry.',
    'profile.agent.copyButton': 'Copy install prompt',
    'profile.agent.copied': 'Copied to clipboard',

    // ─── MerchantDetail page ───
    'detail.back': 'Back to Explorer',
    'detail.loading': 'Loading merchant…',
    'detail.error': "Couldn't load this merchant",
    'detail.badge.verified': 'Verified on 0G Chain',
    'detail.badge.open': 'Open',
    'detail.badge.paused': 'Paused',
    'detail.section.contact': 'Contact & Hours',
    'detail.section.onchain': 'On-chain Proof',
    'detail.section.skills': 'Available Agent Skills',
    'detail.section.specifics': 'Merchant-Specific Fields',
    'detail.field.hours': 'Hours',
    'detail.field.phone': 'Phone',
    'detail.field.email': 'Email',
    'detail.field.website': 'Website',
    'detail.field.wallet': 'Owner wallet',
    'detail.field.did': 'Merchant DID',
    'detail.field.profileHash': 'Profile hash',
    'detail.field.contract': 'Registry contract',
    'detail.viewRegisterTx': 'View register tx on chainscan',
    'detail.onchain.footer': 'Anchored on 0G Galileo testnet (chainId 16602) via the ERC-8004 MerchantRegistry contract.',
    'detail.testSkills': 'Test these skills →',

    // ─── AgentDemo page (main hero only) ───
    'demoPage.title': 'Personal Agent Demo',
    'demoPage.subtitle': 'Connect your wallet to use 0G Compute LLM — your tokens power the AI agent.',
    'demoPage.reset': 'Reset',

    // ─── Registration portal (main hero only) ───
    'register.title': 'Register your Merchant',
    'register.subtitle': 'Publish your hotel, restaurant, or attraction onto the decentralized TourSkill registry. Any AI agent will be able to discover and invoke your on-chain skills.',

    // ─── Common ───
    'common.loading': 'Loading…',
  },
  zh: {
    // ─── Header ───
    'nav.registration': '商家注册',
    'nav.explorer': '商家浏览',
    'nav.demo': 'Agent 演示',
    'header.connect': '连接钱包',
    'header.profile': '个人资料',
    'header.disconnect': '断开连接',
    'header.connectedAs': '已连接',

    // ─── Footer ───
    'footer.copy': '© 2026 TourSkill · 去中心化 A2A 旅游注册表',
    'footer.contract': '智能合约',
    'footer.skillMd': 'SKILL.md',
    'footer.github': 'GitHub',

    // ─── Home: live badge ───
    'home.liveBadge': '0G 测试网已注册 28 家商家',

    // ─── Home: hero ───
    'home.hero.line1': '去中心化',
    'home.hero.line2': 'A2A 旅游注册表',
    'home.hero.subtitle.before': '你的 agent 跟他们的 agent 对话——无 OTA、无中间商。每个商家绑定真实钱包，每次调用通过 ',
    'home.hero.subtitle.highlight': 'x402 微支付',
    'home.hero.subtitle.after': ' 在 HTTP 层结算。',

    // ─── Home: CTAs ───
    'home.cta.human': '我是真人',
    'home.cta.agent': '我是 Agent',
    'home.cta.noAgent.before': '没有 AI agent？',
    'home.cta.noAgent.link': '试用网页版演示',

    // ─── Home: install card ───
    'home.install.tab.personal': '个人 Agent',
    'home.install.tab.merchant': '商家 Agent',
    'home.install.title.personal': '把你的 AI agent 接入 TourSkill',
    'home.install.title.merchant': '让你的商家 agent 接入 TourSkill',
    'home.install.copy': '复制',
    'home.install.copied': '已复制',
    // Personal
    'home.install.personal.step1': '把这句话粘贴给你的个人 agent（Claude Code / Cursor 或任何支持 skill 加载的 AI）',
    'home.install.personal.step2': 'Agent 会自动抓取 SKILL.md——无需鉴权，无需本地后端',
    'home.install.personal.step3.before': '然后跟它说 ',
    'home.install.personal.step3.example': '"帮我找杭州明天的晚餐"',
    'home.install.personal.step3.after': '——亲眼见证 A2A 商业闭环',
    // Merchant
    'home.install.merchant.step1': '把这句话粘贴给你的商家 agent——那个了解你店铺经营情况的 AI',
    'home.install.merchant.step2': 'Agent 起草你的 profile，你确认后通过 MetaMask 一次性签名上链',
    'home.install.merchant.step3.before': '之后随时跟它说 ',
    'home.install.merchant.step3.example': '"更新一下营业时间"',
    'home.install.merchant.step3.after': '——日常修改完全免签',

    // ─── Home: three pillars ───
    'home.pillar1.title': '链上身份',
    'home.pillar1.body': '每个商家通过 ERC-8004 锚定在 0G 链上。身份可验证、可迁移、自主掌控——没有平台能下架你。',
    'home.pillar2.title': 'x402 原生',
    'home.pillar2.body': '首个把支付做进 HTTP 协议的 A2A 注册表。Agent 边缘对 Agent 直接结算——零抽成，不吃 30% OTA 佣金。',
    'home.pillar3.title': 'MCP / A2A 兼容',
    'home.pillar3.body': '标准工具接口——任何支持 MCP 的 AI agent 都能发现、验证、交易。零定制 SDK。',

    // ─── Home: AgentLoopDemo ───
    'demo.badge': '实时演示 · 无真实扣费',
    'demo.title': '看你的 agent 怎么干活',
    'demo.subtitle': '4 次 HTTP 调用，1 条链上回执，中间没有任何平台。',
    'demo.terminalLabel.running': '运行中',
    'demo.terminalLabel.idle': '待机',
    'demo.replay': '重放',
    'demo.restartSoon': '── 几秒后自动重播 ──',
    'demo.cta.before': '想真正试一下？',
    'demo.cta.link': '装载 skill →',

    // ─── Roadmap ───
    'roadmap.badge': '路线图',
    'roadmap.title': '已上线 / 正在建 / 规划中',
    'roadmap.subtitle': '开放注册表 · 商家 agent · 支付 · 信誉——一切公开进行。',
    'roadmap.status.live': '已上线',
    'roadmap.status.building': '建设中',
    'roadmap.status.planned': '规划中',

    // ─── Explorer ───
    'explorer.title': '商家浏览',
    'explorer.subtitle': '发现已上链的商家及其可被 AI agent 调用的技能。',
    'explorer.cityAll': '全部城市',
    'explorer.agentSkills': '可用 Agent 技能',
    'explorer.testSkillApi': '测试 Skill API',
    'explorer.emptyTitle': '未找到商家',
    'explorer.emptyBody': '当前筛选条件下暂无已注册商家。',

    // ─── Status badges ───
    'status.active': '正常营业',
    'status.inactive': '已暂停',

    // ─── Profile page ───
    'profile.connectWallet.title': '连接钱包',
    'profile.connectWallet.body': '用钱包登录后即可查看你的 TourSkill 身份、管理已注册的商家，并把你的 AI agent 接入 TourSkill。',
    'profile.connectWallet.hint': '点击右上角"连接钱包"按钮 →',
    'profile.wallet.title': '钱包身份',
    'profile.wallet.viewChainscan': '在 chainscan 查看',
    'profile.merchants.title': '我的商家',
    'profile.merchants.registerNew': '新增商家',
    'profile.merchants.empty': '当前钱包还没有注册任何商家。',
    'profile.merchants.emptyCta': '注册第一家',
    'profile.merchants.pause': '暂停营业',
    'profile.merchants.resume': '恢复营业',
    'profile.merchants.updating': '更新中……',
    'profile.merchants.toggleError': '切换状态失败——请检查网络后重试。',
    'profile.agent.title': '接入你的 AI Agent',
    'profile.agent.body': '把下面这一行粘贴给你的个人 AI agent，它会自动抓取 TourSkill SKILL.md 并开始跟链上注册表交互。',
    'profile.agent.copyButton': '复制安装命令',
    'profile.agent.copied': '已复制到剪贴板',

    // ─── MerchantDetail page ───
    'detail.back': '返回商家列表',
    'detail.loading': '加载商家详情……',
    'detail.error': '加载失败',
    'detail.badge.verified': '已上链 0G',
    'detail.badge.open': '营业中',
    'detail.badge.paused': '已暂停',
    'detail.section.contact': '联系方式 & 营业时间',
    'detail.section.onchain': '链上凭证',
    'detail.section.skills': '可用 Agent 技能',
    'detail.section.specifics': '商家特定字段',
    'detail.field.hours': '营业时间',
    'detail.field.phone': '电话',
    'detail.field.email': '邮箱',
    'detail.field.website': '官网',
    'detail.field.wallet': '所有者钱包',
    'detail.field.did': '商家 DID',
    'detail.field.profileHash': 'Profile 哈希',
    'detail.field.contract': '注册表合约',
    'detail.viewRegisterTx': '在 chainscan 查看注册交易',
    'detail.onchain.footer': '锚定在 0G Galileo 测试网 (chainId 16602)，通过 ERC-8004 MerchantRegistry 合约。',
    'detail.testSkills': '试用这些技能 →',

    // ─── AgentDemo page (main hero only) ───
    'demoPage.title': '个人 Agent 演示',
    'demoPage.subtitle': '连接你的钱包以使用 0G Compute LLM——你钱包里的 tokens 为 AI agent 的推理买单。',
    'demoPage.reset': '重置',

    // ─── Registration portal (main hero only) ───
    'register.title': '注册你的商家',
    'register.subtitle': '把你的酒店、餐厅或景点发布到 TourSkill 去中心化注册表。任何 AI agent 都能发现并调用你链上声明的技能。',

    // ─── Common ───
    'common.loading': '加载中……',
  },
}

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const Ctx = createContext<LanguageCtx | null>(null)

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  // Auto-detect from browser — any zh-* locale goes to 'zh'
  const nav = navigator.language?.toLowerCase() ?? ''
  return nav.startsWith('zh') ? 'zh' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang())

  // Keep <html lang="…"> in sync for a11y + search engines
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: string): string => {
    return TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? key
  }, [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useT(): LanguageCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useT must be used inside <LanguageProvider>')
  return v
}
