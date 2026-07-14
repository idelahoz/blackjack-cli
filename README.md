# @idelahoz/blackjack-cli

![Node 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen) ![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue) ![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey)

Command-line interface for [`@idelahoz/blackjack-engine`](https://github.com/idelahoz/blackjack-engine) — basic-strategy moves, expected value, and cash-out recommendations.

## Install

Requires Node 22+.

```sh
npm install -g @idelahoz/blackjack-cli   # or: pnpm add -g @idelahoz/blackjack-cli
blackjack
```

Or run it without installing:

```sh
npx @idelahoz/blackjack-cli
```

### From source

```sh
git clone git@github.com:idelahoz/blackjack-cli.git
cd blackjack-cli && pnpm install && pnpm build
node dist/index.js        # or `npm link` for a global `blackjack` command
```

The engine dependency ([`@idelahoz/blackjack-engine`](https://www.npmjs.com/package/@idelahoz/blackjack-engine)) installs from npm either way.

## Usage

### Interactive (fastest)

Just run `blackjack` — anything you don't pass as a flag is prompted, with instant validation and re-ask on typos:

```
$ blackjack
Bet amount: 100
Your hand ("A,7", "A 7", or a hard total like "16"): A,7
Dealer up card: 9
Cash-out offer (press Enter to skip): 82
Current Hand    A,7 (soft 18)
Dealer          9
Strategy        Hit
Expected Value  0.90
Cash Out        82 (0.82 units)
Recommendation  Continue

Now you must HIT
```

The closing `Now you must <ACTION>` line is the single move to make once every engine has weighed in — when the cash-out offer beats the EV of continuing, it says `CASH OUT` regardless of the table action.

Flags and prompts mix freely — `blackjack --bet 100` asks only for the hand, dealer, and (optional) cash-out.

### Flags (script-friendly)

```sh
blackjack recommend \
    --bet 100 \
    --hand "A,7" \
    --dealer 9 \
    --cashout 82
```

The `recommend` subcommand is the default, so it can be omitted. Fully-flagged invocations never prompt and never read stdin.

Expected Value is the engine's unit convention: expected total return per unit bet (`1.0` = break even, `0.90` = expect back 90% of the wager). The recommendation is `Cash Out` exactly when the offer exceeds `EV × bet`.

### Options

| flag                    | required | description                                                                                                                                                                                                                                                                       |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bet <amount>`        | yes      | original wager                                                                                                                                                                                                                                                                    |
| `--hand <cards\|total>` | yes      | player cards, separated by commas and/or spaces (`"A,7"`, `"A 7"`, `"10 J 3"`; `T` = 10; quote the value when using spaces) — or a single number 4–21 treated as a **hard total** (`16` = hard 16; splitting is disabled for total inputs, and `10` means hard ten, not the card) |
| `--dealer <card>`       | yes      | dealer up card (`9`, `J`, `A`)                                                                                                                                                                                                                                                    |
| `--cashout <amount>`    | no       | cash-out offer; omit to just see the strategy move + EV                                                                                                                                                                                                                           |
| `--strategy <path>`     | no       | strategy JSON file (default: the engine's bundled `s17.json`)                                                                                                                                                                                                                     |
| `--json`                | no       | machine-readable output                                                                                                                                                                                                                                                           |

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

# Use the bundled H17 chart (or any custom strategy JSON) instead of the s17 default
blackjack recommend --bet 100 --hand "5,6" --dealer A \
  --strategy "$(npm root -g)/@idelahoz/blackjack-cli/node_modules/@idelahoz/blackjack-engine/strategies/h17.json"
# (from an engine checkout, simply: --strategy path/to/strategies/h17.json)

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
