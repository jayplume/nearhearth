# Architecture

```mermaid
flowchart TB
  subgraph Pkg["packages/hearth (TypeScript, no dependencies)"]
    R["rules.ts<br/>the rules in bigint"]
    ST["strategies.ts<br/>keeper decisions + reasons"]
    SIM["sim.ts<br/>seeded multi-agent simulation"]
    CH["chain.ts<br/>accounts, RPC fallbacks, views"]
  end
  subgraph Contract["contract (Rust, near-sdk 5.29)"]
    L["lib.rs<br/>EMBER NEP-141 + the hearth"]
    V["tests/vector.json<br/>shared with rules.ts"]
  end
  subgraph Scripts["scripts (Node, near-api-js 7)"]
    SW["swarm.ts"]
    CO["council.ts"]
    SU["setup-keepers.ts"]
    TU["top-up.ts"]
    STA["status.ts"]
    D["doctor.ts"]
  end
  subgraph Web["apps/web (React 19, Vite 7)"]
    UI["pages + components"]
    LV["lib/live.ts<br/>polling snapshot"]
    WA["lib/wallet.ts<br/>wallet-selector 10"]
  end
  R --> SIM
  ST --> SIM
  R -. "writes" .-> V
  V -. "replayed by cargo test" .-> L
  ST --> SW
  CH --> SW
  CH --> CO
  CH --> LV
  ST --> UI
  LV --> UI
  WA --> L
  SW --> L
  CO --> DAO[("Sputnik DAO")]
```

## Boundaries

- **The contract is the source of truth.** Nothing off chain can change an outcome. Scripts and the site only read state and send the same calls a holder could.
- **`packages/hearth` has no runtime dependencies** and runs in Node and the browser. The site, the scripts and the tests all import the same rules and strategies.
- **Reads are batched.** The site's full refresh is about six RPC calls (`get_state`, `list_rounds`, `list_warmth`, `get_accounts` for the whole swarm, and two DAO views); between refreshes it polls `get_state` only.
- **Writes are retried only on rate limits.** A 429 means the transaction was not accepted, so `scripts/lib/signer.ts` tries the next RPC; any other error is reported, never retried blindly.

## Data flow of one round

1. Keepers (and people) call `pledge`; the contract moves EMBER to escrow.
2. After the round ends, the first `close_rounds`, `pledge` or `claim` settles it: burns, a round record, events.
3. Pledgers call `claim_all`; sparks are minted (roared) or refunds paid (out), and warmth is credited.
4. The site sees the new round in its next poll and throws sparks if it roared.
