import { describe, it, expect, beforeEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import {
  mintChallenge, verifyAndMintToken, resolveToken, _resetAuthState,
} from '../src/core/auth.js';

const PK    = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
const acct  = privateKeyToAccount(PK);

beforeEach(() => _resetAuthState());

describe('challenge → verify → token flow', () => {
  it('mints a challenge bound to a wallet', () => {
    const c = mintChallenge(acct.address);
    expect(c.nonce).toBeTruthy();
    expect(c.message).toContain(acct.address.toLowerCase());
    expect(c.message).toContain(c.nonce);
  });

  it('verifies a valid signature and mints a bearer token', async () => {
    const c    = mintChallenge(acct.address);
    const sig  = await acct.signMessage({ message: c.message });
    const out  = await verifyAndMintToken(acct.address, c.nonce, sig);
    expect(out.token).toBeTruthy();
    expect(out.wallet).toBe(acct.address.toLowerCase());

    expect(resolveToken(out.token)).toBe(acct.address.toLowerCase());
  });

  it('rejects nonce reuse (one-shot)', async () => {
    const c   = mintChallenge(acct.address);
    const sig = await acct.signMessage({ message: c.message });
    await verifyAndMintToken(acct.address, c.nonce, sig);

    await expect(verifyAndMintToken(acct.address, c.nonce, sig))
      .rejects.toThrow(/Invalid or expired nonce/);
  });

  it('rejects mismatched wallet', async () => {
    const c = mintChallenge(acct.address);
    const sig = await acct.signMessage({ message: c.message });
    await expect(verifyAndMintToken(
      '0x000000000000000000000000000000000000dead',
      c.nonce,
      sig,
    )).rejects.toThrow(/Wallet does not match nonce/);
  });

  it('rejects signature from a different key', async () => {
    const c = mintChallenge(acct.address);
    const otherPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const otherAcct = privateKeyToAccount(otherPk);
    const sig = await otherAcct.signMessage({ message: c.message });
    await expect(verifyAndMintToken(acct.address, c.nonce, sig))
      .rejects.toThrow(/Signature does not recover/);
  });

  it('resolves an unknown token to null', () => {
    expect(resolveToken('not-a-real-token')).toBeNull();
    expect(resolveToken('')).toBeNull();
  });
});
