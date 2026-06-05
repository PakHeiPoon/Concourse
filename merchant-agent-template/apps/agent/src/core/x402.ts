/**
 * x402 paid-skill support (Block 1 — stateless per-call micropayment).
 *
 * Wire format follows the x402 "exact" scheme on EVM:
 *   1. A paid skill with no payment → HTTP 402 + PaymentRequirements body.
 *   2. The client signs an EIP-3009 `transferWithAuthorization` (gasless for
 *      the payer) and resends with an `X-PAYMENT` header (base64 JSON).
 *   3. We verify the signature + terms, then SELF-SETTLE: submit
 *      `transferWithAuthorization(...)` to USDC ourselves (we pay gas, USDC
 *      moves payer → merchant). No external facilitator.
 *
 * Settlement needs a funded wallet: SETTLEMENT_PRIVATE_KEY (the merchant's
 * own key). Only set on paid-skill merchants.
 */

import {
  createPublicClient, createWalletClient, http, parseAbi,
  verifyTypedData, getAddress, type Hex, type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import type { SkillDef, PaymentProof } from './types.js';

const NETWORK = 'eip155:84532';            // Base Sepolia (CAIP-2)
const USDC = (process.env.USDC_ADDRESS
  ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as Address;
const RPC = process.env.RPC_URL ?? 'https://sepolia.base.org';
// USDC (FiatTokenV2_2) EIP-712 domain for EIP-3009. name/version are fixed
// for Circle's USDC; the verifyingContract is the token address.
const EIP712_NAME = 'USDC';
const EIP712_VERSION = '2';

const USDC_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)',
]);

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/** A skill charges when it has a positive flat price and isn't marked free. */
export function priceBaseUnits(skill: SkillDef<unknown, unknown>): bigint {
  const p = skill.pricing;
  if (!p || p.free) return 0n;
  if (p.type === 'flat' && typeof p.flatUsdc === 'number' && p.flatUsdc > 0) {
    return BigInt(p.flatUsdc); // flatUsdc is stored in USDC base units (6 decimals)
  }
  return 0n;
}

export function isPaid(skill: SkillDef<unknown, unknown>): boolean {
  return priceBaseUnits(skill) > 0n;
}

/** The 402 body a client uses to construct its payment. */
export function paymentRequirements(
  skill: SkillDef<unknown, unknown>,
  payTo: string,
  resourceUrl: string,
) {
  const amount = priceBaseUnits(skill).toString();
  return {
    x402Version: 1,
    error: 'X-PAYMENT header required',
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        maxAmountRequired: amount,
        resource: resourceUrl,
        description: `Payment for ${skill.name}`,
        mimeType: 'application/json',
        payTo: getAddress(payTo),
        maxTimeoutSeconds: 300,
        asset: USDC,
        extra: { name: EIP712_NAME, version: EIP712_VERSION },
      },
    ],
  };
}

interface Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export class PaymentError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentError'; }
}

/**
 * Verify the X-PAYMENT header against the skill's terms, then settle the
 * USDC transfer on-chain. Returns a PaymentProof on success; throws
 * PaymentError on any verification/settlement failure.
 */
export async function verifyAndSettle(
  xPaymentHeader: string,
  skill: SkillDef<unknown, unknown>,
  payTo: string,
): Promise<PaymentProof> {
  const settlementKey = process.env.SETTLEMENT_PRIVATE_KEY;
  if (!settlementKey) throw new PaymentError('merchant has no SETTLEMENT_PRIVATE_KEY configured');

  let decoded: { payload?: { signature?: Hex; authorization?: Authorization } };
  try {
    decoded = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf8'));
  } catch {
    throw new PaymentError('X-PAYMENT header is not valid base64 JSON');
  }
  const sig = decoded.payload?.signature;
  const auth = decoded.payload?.authorization;
  if (!sig || !auth) throw new PaymentError('X-PAYMENT missing signature or authorization');

  const required = priceBaseUnits(skill);
  const value = BigInt(auth.value);
  const now = Math.floor(Date.now() / 1000);

  // ── Terms checks ──
  if (getAddress(auth.to) !== getAddress(payTo)) throw new PaymentError('authorization.to ≠ merchant payTo');
  if (value < required) throw new PaymentError(`amount ${value} < required ${required}`);
  if (Number(auth.validBefore) <= now) throw new PaymentError('authorization expired');
  if (Number(auth.validAfter) > now) throw new PaymentError('authorization not yet valid');

  // ── Signature check (EIP-712 / EIP-3009) ──
  const valid = await verifyTypedData({
    address: getAddress(auth.from),
    domain: {
      name: EIP712_NAME,
      version: EIP712_VERSION,
      chainId: baseSepolia.id,
      verifyingContract: USDC,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: getAddress(auth.from),
      to: getAddress(auth.to),
      value,
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
    },
    signature: sig,
  });
  if (!valid) throw new PaymentError('EIP-3009 signature does not recover to authorization.from');

  // ── Settle: submit transferWithAuthorization (we pay gas) ──
  const account = privateKeyToAccount(settlementKey.startsWith('0x') ? settlementKey as Hex : `0x${settlementKey}`);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });
  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

  let txHash: Hex;
  try {
    txHash = await wallet.writeContract({
      address: USDC,
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        getAddress(auth.from), getAddress(auth.to), value,
        BigInt(auth.validAfter), BigInt(auth.validBefore), auth.nonce, sig,
      ],
    });
  } catch (e) {
    throw new PaymentError(`settlement tx failed: ${(e as Error).message.slice(0, 160)}`);
  }
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new PaymentError(`settlement reverted (${txHash})`);

  return {
    payer:        getAddress(auth.from),
    amountUsdc:   Number(value),
    escrowTxHash: txHash,
    intentId:     auth.nonce,
  };
}

/** The header a successful settlement echoes back (x402 PAYMENT-RESPONSE). */
export function paymentResponseHeader(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify({
    success: true,
    txHash: proof.escrowTxHash,
    payer: proof.payer,
    amount: proof.amountUsdc.toString(),
    network: NETWORK,
  }), 'utf8').toString('base64');
}
