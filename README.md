# btc-whale-check

Is a "Bitcoin whale move" real, or just a wallet paying itself?

Many whale alerts add up every output of a big transaction, including coins that go straight back to the sender. This small script checks one transaction against public data and tells you how much **actually left** the sender.

No dependencies. One file. Node 18+.

## Usage

```bash
node whale-check.js <txhash>                   # default floor: $50M
node whale-check.js <txhash> --floor=100000000 # custom USD floor
```

Exit codes: `0` real move above the floor, `1` not a whale move (or couldn't verify), `2` bad usage.

## Two real examples (block 972,539, Oct 21 2026)

**A real move.** 4,521 BTC left two addresses and went to ten others:

```
$ node whale-check.js f68aa8d3e0b5bb1bc95521b57207cb65822c43fc4ff212cc8d8588e3b6b20963
tx f68aa8d3e0b5...  confirmed=true (block 972539)
inputs=2 outputs=10  total out=4521.15 BTC
NET moved to other addresses = 4521.15 BTC = $368.7M at spot $81552  (returned to own input addresses: 0.00 BTC)
REAL MOVE: 4521 BTC (~$369M) moved to other addresses in a confirmed transaction
```

**Not a move.** Same block, 2,489 BTC (~$203M) "moved", but every coin went back to one of the sender's own addresses (17 inputs consolidated into one). A naive whale alert reports this as a $200M+ whale:

```
$ node whale-check.js 8ead60665d30a1dd83378c6fa1de60979972bde9b7b5d16c73101a0921275e0c
tx 8ead60665d30...  confirmed=true (block 972539)
inputs=17 outputs=2  total out=2489.73 BTC
NET moved to other addresses = 0.00 BTC = $0.0M at spot $81552  (returned to own input addresses: 2489.73 BTC)
NOT A WHALE MOVE: self-transfer: every output returns to its own input addresses; net movement $0.0M is below the $50M floor
```

## How it works

1. Fetches the transaction from blockchain.info and the BTC/USD spot price from Coinbase.
2. Collects the addresses the inputs came from.
3. Counts only outputs going to *other* addresses (net movement). Change back to an input address is excluded. Zero-value OP_RETURN outputs add nothing.
4. Requires the transaction to be confirmed in a block.

Limits: it can't tell you who owns an address. Change sent to a *new* address owned by the same entity still counts as moved, so treat the result as an upper bound on real movement.

## Where this comes from

This is the check behind the Bitcoin whale alerts in [Squelch](https://squelchalerts.com), a crypto alert bot for Telegram and the web. A few of the biggest checked moves are posted free at [t.me/SquelchAlerts](https://t.me/SquelchAlerts).

## License

MIT
