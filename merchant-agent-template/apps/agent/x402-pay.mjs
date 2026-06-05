// x402 client — pay for a skill end to end.
//
//   PAYER_KEY=0x… node x402-pay.mjs <agent-base-url> <skill> '<json-input>'
//
// 1. Call the skill → get 402 + PaymentRequirements.
// 2. Sign an EIP-3009 transferWithAuthorization for the required amount.
// 3. Retry with the X-PAYMENT header; the merchant verifies + settles.
import { createPublicClient, http, parseAbi, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { randomBytes } from 'node:crypto';

const [base, skill, inputJson] = process.argv.slice(2);
const PAYER_KEY = process.env.PAYER_KEY;
const RPC = process.env.RPC_URL ?? 'https://sepolia.base.org';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
if (!base || !skill || !PAYER_KEY) {
  console.error('usage: PAYER_KEY=0x.. node x402-pay.mjs <base-url> <skill> <json-input>');
  process.exit(1);
}

const account = privateKeyToAccount(PAYER_KEY.startsWith('0x') ? PAYER_KEY : '0x' + PAYER_KEY);
const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const url = `${base}/skills/${skill}`;
const body = inputJson ?? '{}';

const usdcBal = (addr) => pub.readContract({
  address: USDC, abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
  functionName: 'balanceOf', args: [getAddress(addr)],
});

// ── Step 1: hit the skill, expect 402 ──
let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
if (res.status !== 402) {
  console.log(`unexpected ${res.status} (skill may be free):`, await res.text());
  process.exit(0);
}
const req = (await res.json()).accepts[0];
console.log(`402 → pay ${req.maxAmountRequired} (base units) of USDC to ${req.payTo}`);

const payerBefore = await usdcBal(account.address);
const merchantBefore = await usdcBal(req.payTo);

// ── Step 2: sign EIP-3009 transferWithAuthorization ──
const now = Math.floor(Date.now() / 1000);
const authorization = {
  from: account.address,
  to: getAddress(req.payTo),
  value: BigInt(req.maxAmountRequired),
  validAfter: 0n,
  validBefore: BigInt(now + req.maxTimeoutSeconds),
  nonce: ('0x' + randomBytes(32).toString('hex')),
};
const signature = await account.signTypedData({
  domain: { name: req.extra.name, version: req.extra.version, chainId: baseSepolia.id, verifyingContract: getAddress(USDC) },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: authorization,
});

const xPayment = Buffer.from(JSON.stringify({
  x402Version: 1, scheme: 'exact', network: req.network,
  payload: {
    signature,
    authorization: {
      ...authorization,
      value: authorization.value.toString(),
      validAfter: authorization.validAfter.toString(),
      validBefore: authorization.validBefore.toString(),
    },
  },
}), 'utf8').toString('base64');

// ── Step 3: retry with payment ──
console.log('paying…');
res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-PAYMENT': xPayment },
  body,
});
const out = await res.json();
console.log(`\nHTTP ${res.status}`);
console.log('result:', JSON.stringify(out, null, 2));
const settleHeader = res.headers.get('x-payment-response');
if (settleHeader) {
  console.log('settlement:', JSON.parse(Buffer.from(settleHeader, 'base64').toString('utf8')));
}

// Let the read-RPC node catch up to the settled balance before re-reading.
await new Promise((r) => setTimeout(r, 4000));
const payerAfter = await usdcBal(account.address);
const merchantAfter = await usdcBal(req.payTo);
const d = (a, b) => (Number(b - a) / 1e6).toFixed(6);
console.log(`\nUSDC moved:`);
console.log(`  payer    ${account.address}: ${d(payerBefore, payerAfter)} USDC`);
console.log(`  merchant ${req.payTo}: +${d(merchantBefore, merchantAfter)} USDC`);
