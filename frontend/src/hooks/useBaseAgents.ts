/**
 * Pull the active agent list from ERC-8004 IdentityRegistry on Base Sepolia.
 *
 * Read-only, no wallet required. Re-fetches on `refresh()`.
 */

import { useCallback, useEffect, useState } from 'react'
import { listAllAgents, type OnChainAgent } from '../lib/erc8004'

interface UseBaseAgentsState {
  agents:   OnChainAgent[]
  loading:  boolean
  error:    string | null
  refresh:  () => void
}

export function useBaseAgents(): UseBaseAgentsState {
  const [agents,  setAgents]  = useState<OnChainAgent[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tick,    setTick]    = useState<number>(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAllAgents()
      .then((list) => {
        if (cancelled) return
        setAgents(list)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick])

  return { agents, loading, error, refresh }
}
