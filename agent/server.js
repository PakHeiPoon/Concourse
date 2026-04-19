import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MCP_BASE = process.env.MCP_BASE_URL || "http://localhost:8000";

// ── 0G Compute Broker (lazy init) ──────────────────────────────────
let broker = null;
let providerAddress = null;
let serviceEndpoint = null;
let serviceModel = null;

async function ensureBroker() {
  if (broker) return;
  console.log("[0G] Initializing compute broker...");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  broker = await createZGComputeNetworkBroker(wallet);

  // Discover chatbot provider
  console.log("[0G] Discovering chatbot providers...");
  const services = await broker.inference.listService();
  const chatbots = services.filter((s) => s[1] === "chatbot");

  if (chatbots.length === 0) {
    throw new Error("No chatbot providers found on 0G Compute Network");
  }

  // Pick first available provider
  const selected = chatbots[0];
  providerAddress = selected[0];
  serviceModel = selected[6];
  console.log(`[0G] Selected provider: ${providerAddress}`);
  console.log(`[0G] Model: ${serviceModel}`);

  // Get endpoint
  const meta = await broker.inference.getServiceMetadata(providerAddress);
  serviceEndpoint = meta.endpoint;
  console.log(`[0G] Endpoint: ${serviceEndpoint}`);

  // Acknowledge provider (safe to call multiple times)
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log("[0G] Provider acknowledged");
  } catch (e) {
    console.log("[0G] Provider may already be acknowledged:", e.message?.slice(0, 80));
  }
}

// ── MCP Tool Definitions for LLM ──────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "discover_merchants",
      description:
        "Search the TourSkill decentralized registry for tourism merchants (hotels, restaurants, attractions) by city, type, or keyword.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name in lowercase (e.g. hangzhou, shanghai)" },
          type: { type: "string", enum: ["hotel", "restaurant", "attraction"], description: "Merchant category" },
          keyword: { type: "string", description: "Free-text search in merchant names" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "invoke_merchant_skill",
      description:
        "Invoke a specific skill on a registered merchant (e.g. get_menu, check_availability, reserve_table, purchase_ticket). Returns structured data.",
      parameters: {
        type: "object",
        properties: {
          did: { type: "string", description: "Merchant merchant_id from discovery results" },
          skill_name: { type: "string", description: "Skill to invoke (e.g. get_menu, check_availability)" },
          skill_args: { type: "object", description: "Arguments for the skill" },
        },
        required: ["did", "skill_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_merchant_details",
      description: "Get full profile details for a specific merchant by ID.",
      parameters: {
        type: "object",
        properties: {
          merchant_id: { type: "string", description: "The merchant_id to look up" },
        },
        required: ["merchant_id"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a helpful AI travel assistant powered by the TourSkill decentralized registry on the 0G Network.

You help users discover tourism merchants (hotels, restaurants, attractions) and interact with their on-chain skills.

You have access to tools to:
1. discover_merchants — search the registry by city, type, or keyword
2. invoke_merchant_skill — call a merchant's skill API (get_menu, check_availability, reserve_table, etc.)
3. get_merchant_details — get full merchant profile

When a user asks about dining, hotels, or attractions in a city:
1. First use discover_merchants to find relevant merchants
2. Then use invoke_merchant_skill to get details like menus, availability, or rates
3. Present the results in a friendly, helpful way
4. Offer to take action (reserve table, book room, purchase ticket) if appropriate

Always be concise and helpful. Format prices with ¥ symbol for CNY.
Today's date is ${new Date().toISOString().slice(0, 10)}.
Tomorrow's date is ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}.`;

// ── Execute MCP tool via backend ───────────────────────────────────
async function executeMcpTool(toolName, args) {
  const res = await fetch(`${MCP_BASE}/mcp/tools/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: toolName, arguments: args }),
  });
  const data = await res.json();
  if (data.isError) {
    return { error: true, text: data.content?.[0]?.text || "Tool execution failed" };
  }
  return { error: false, text: data.content?.[0]?.text || "{}" };
}

// ── Chat with 0G Compute LLM ──────────────────────────────────────
async function chatWithLLM(messages) {
  await ensureBroker();

  const headers = await broker.inference.getRequestHeaders(providerAddress);

  const response = await fetch(`${serviceEndpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages,
      model: serviceModel,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`0G Compute error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // CRITICAL: processResponse for fee settlement
  let chatID = response.headers.get("ZG-Res-Key") || response.headers.get("zg-res-key");
  if (!chatID) chatID = data.id;
  await broker.inference.processResponse(providerAddress, chatID, JSON.stringify(data.usage || {}));

  return data;
}

// ── Agent chat loop (handles tool calls) ───────────────────────────
async function agentChat(conversationMessages) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...conversationMessages];
  const toolLog = [];
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const result = await chatWithLLM(messages);
    const choice = result.choices?.[0];

    if (!choice) {
      return { reply: "Sorry, I didn't get a response from the AI model.", toolLog };
    }

    // If model wants to call tools
    if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length > 0) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fn = toolCall.function;
        const args = JSON.parse(fn.arguments || "{}");

        toolLog.push({
          type: "tool_call",
          name: fn.name,
          args,
          time: new Date().toISOString(),
        });

        console.log(`[Tool] ${fn.name}(${JSON.stringify(args)})`);
        const toolResult = await executeMcpTool(fn.name, args);

        toolLog.push({
          type: "tool_result",
          name: fn.name,
          error: toolResult.error,
          preview: toolResult.text.slice(0, 200),
          time: new Date().toISOString(),
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult.text,
        });
      }

      // Continue loop to let model process tool results
      continue;
    }

    // Model responded with text (no more tool calls)
    return {
      reply: choice.message?.content || "I processed your request but have no additional text to show.",
      toolLog,
      model: serviceModel,
      provider: providerAddress,
    };
  }

  return { reply: "I ran out of steps processing your request. Please try a simpler query.", toolLog };
}

// ── API Routes ─────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", model: serviceModel, provider: providerAddress });
});

// Chat endpoint
app.post("/v1/agent/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    console.log(`[Chat] ${messages.length} message(s), last: "${messages.at(-1)?.content?.slice(0, 50)}"`);
    const result = await agentChat(messages);
    res.json(result);
  } catch (error) {
    console.error("[Chat Error]", error);
    res.status(500).json({
      error: error.message || "Agent chat failed",
      hint: error.message?.includes("balance")
        ? "Insufficient 0G compute balance. Deposit funds to your account."
        : error.message?.includes("provider")
          ? "No compute providers available. Try again later."
          : undefined,
    });
  }
});

// Provider info
app.get("/v1/agent/provider", async (req, res) => {
  try {
    await ensureBroker();
    res.json({ provider: providerAddress, model: serviceModel, endpoint: serviceEndpoint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🤖 TourSkill Agent Server running on http://localhost:${PORT}`);
  console.log(`   POST /v1/agent/chat — Chat with 0G-powered AI agent`);
  console.log(`   GET  /v1/agent/provider — View current 0G compute provider\n`);
});
