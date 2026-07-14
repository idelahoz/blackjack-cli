# @blackjack/cli

![Node 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen) ![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)

Command-line interface for [`@blackjack/engine`](https://github.com/idelahoz/blackjack-engine) — basic-strategy moves, expected value, and cash-out recommendations.

## Setup

Requires Node 22+ and a sibling checkout of the engine (the dependency is linked locally via `link:../blackjack-engine` until the engine is published to npm):

```sh
git clone git@github.com:idelahoz/blackjack-engine.git
git clone git@github.com:idelahoz/blackjack-cli.git

cd blackjack-engine && pnpm install && pnpm build
cd ../blackjack-cli && pnpm install && pnpm build
```

Run it as `node dist/index.js …`, or `npm link` to get a global `blackjack` command.

## Usage

```sh
blackjack recommend \
    --bet 100 \
    --hand "A,7" \
    --dealer 9 \
    --cashout 82
```

```
Current Hand    A,7 (soft 18)
Dealer          9
Strategy        Hit
Expected Value  0.90
Cash Out        82 (0.82 units)
Recommendation  Continue
```

Expected Value is the engine's unit convention: expected total return per unit bet (`1.0` = break even, `0.90` = expect back 90% of the wager). The recommendation is `Cash Out` exactly when the offer exceeds `EV × bet`.

### Options

| flag                    | required | description                                                                                                                                                                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bet <amount>`        | yes      | original wager                                                                                                                                                                                                      |
| `--hand <cards\|total>` | yes      | player cards, comma separated (`"A,7"`, `"10,J,3"`; `T` = 10) — or a single number 4–21 treated as a **hard total** (`16` = hard 16; splitting is disabled for total inputs, and `10` means hard ten, not the card) |
| `--dealer <card>`       | yes      | dealer up card (`9`, `J`, `A`)                                                                                                                                                                                      |
| `--cashout <amount>`    | no       | cash-out offer; omit to just see the strategy move + EV                                                                                                                                                             |
| `--strategy <path>`     | no       | strategy JSON file (default: the engine's bundled `s17.json`)                                                                                                                                                       |
| `--json`                | no       | machine-readable output                                                                                                                                                                                             |

### More examples

```sh
# Pair splitting
blackjack recommend --bet 100 --hand "8,8" --dealer 10

# Late surrender
blackjack recommend --bet 100 --hand "10,6" --dealer 10 --cashout 55
# → Strategy Surrender, EV 0.50, Recommendation Cash Out (0.55 > 0.50)

# Hard total instead of cards
blackjack recommend --bet 100 --hand 16 --dealer 10
# → same as any hard 16 vs 10

# Use the H17 chart instead
blackjack recommend --bet 100 --hand "5,6" --dealer A \
  --strategy ../blackjack-engine/strategies/h17.json

# JSON output
blackjack recommend --bet 100 --hand "A,7" --dealer 9 --cashout 82 --json
```

Invalid input (bad cards, non-positive bets, missing strategy files) prints a message to stderr and exits with code 1.

## Development

```sh
pnpm test        # vitest — option parsing + end-to-end runs against the real engine
pnpm build       # tsup → dist/index.js (ESM, shebang)
pnpm lint
pnpm typecheck
```

## Creator

**Israel De La Hoz**

- GitHub: [@idelahoz](https://github.com/idelahoz)
- LinkedIn: [israel-de-la-hoz](https://www.linkedin.com/in/israel-de-la-hoz-ba973326/)
