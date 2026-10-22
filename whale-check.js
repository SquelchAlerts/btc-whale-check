#!/usr/bin/env node
// btc-whale-check: is a "Bitcoin whale move" real, or just a wallet paying itself?
// Usage: node whale-check.js <txhash> [--floor=USD]   (default floor: $50M)
//
// Many "whale alerts" count every output of a big transaction, including change that goes
// straight back to the sender. This checks one transaction independently and reports:
//   - whether it is confirmed in a block,
//   - the NET amount that went to addresses other than the transaction's own inputs,
//   - whether it is a pure self-transfer.
// Exit code 0 = real move above the floor, 1 = not (or could not verify), 2 = bad usage.
// Data: blockchain.info (transaction) and Coinbase (BTC/USD spot). No dependencies, Node 18+.
const hash = process.argv[2];
const floorArg = process.argv.find((a) => a.startsWith('--floor='));
const FLOOR_USD = floorArg ? Number(floorArg.split('=')[1]) : 50_000_000;
if (!/^[0-9a-f]{64}$/i.test(hash || '')) {
  console.error('Usage: node whale-check.js <64-hex txhash> [--floor=USD]');
  process.exit(2);
}

(async () => {
  const [txRes, pxRes] = await Promise.all([
    fetch(`https://blockchain.info/rawtx/${hash}`, { signal: AbortSignal.timeout(20000) }),
    fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', { signal: AbortSignal.timeout(15000) }),
  ]);
  if (!txRes.ok) { console.log(`NOT VERIFIED: transaction lookup failed (HTTP ${txRes.status})`); process.exit(1); }
  const tx = await txRes.json();
  const price = Number((await pxRes.json()).data.amount);
  const inAddrs = new Set((tx.inputs || []).map((i) => i.prev_out && i.prev_out.addr).filter(Boolean));
  const outs = tx.out || [];
  const totalBtc = outs.reduce((s, o) => s + o.value, 0) / 1e8;
  const toOthers = outs.filter((o) => !(o.addr && inAddrs.has(o.addr)));
  const netBtc = toOthers.reduce((s, o) => s + o.value, 0) / 1e8;
  const netUsd = netBtc * price;
  const confirmed = Boolean(tx.block_height);
  const selfTransfer = inAddrs.size > 0 && netBtc === 0;

  console.log(`tx ${hash.slice(0, 12)}...  confirmed=${confirmed}${confirmed ? ` (block ${tx.block_height})` : ''}`);
  console.log(`inputs=${tx.inputs.length} outputs=${outs.length}  total out=${totalBtc.toFixed(2)} BTC`);
  console.log(`NET moved to other addresses = ${netBtc.toFixed(2)} BTC = $${(netUsd / 1e6).toFixed(1)}M at spot $${price.toFixed(0)}` +
              `  (returned to own input addresses: ${(totalBtc - netBtc).toFixed(2)} BTC)`);

  const reasons = [];
  if (!confirmed) reasons.push('not confirmed in a block yet');
  if (selfTransfer) reasons.push('self-transfer: every output returns to its own input addresses');
  if (netUsd < FLOOR_USD) reasons.push(`net movement $${(netUsd / 1e6).toFixed(1)}M is below the $${FLOOR_USD / 1e6}M floor`);
  if (reasons.length) { console.log('NOT A WHALE MOVE: ' + reasons.join('; ')); process.exit(1); }
  console.log(`REAL MOVE: ${netBtc.toFixed(0)} BTC (~$${(netUsd / 1e6).toFixed(0)}M) moved to other addresses in a confirmed transaction`);
  process.exit(0);
})().catch((e) => { console.log('NOT VERIFIED: ' + e.message); process.exit(1); });
