/**
 * Vercel Edge function — managed LLM proxy for the public Agent Demo.
 *
 * Visitors don't bring their own key: the browser POSTs the OpenAI-style
 * chat body here, and we forward it to Qiniu AIGC with our server-side
 * QINIU_API_KEY and a fixed model. The key never reaches the client.
 *
 * Set QINIU_API_KEY in the Vercel project (Production env).
 */

export const config = { runtime: 'edge' }

const QINIU_URL = 'https://api.qnaigc.com/v1/chat/completions'
const MODEL = 'deepseek/deepseek-v4-flash'

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const key = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.QINIU_API_KEY
  if (!key) return json({ error: 'llm_not_configured' }, 500)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // Force our model + key; pass through messages/tools/tool_choice as-is.
  const upstream = await fetch(QINIU_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...body, model: MODEL }),
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}

function cors(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
