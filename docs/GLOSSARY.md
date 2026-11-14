# Glossary

| Word | Meaning |
|---|---|
| **EMBER** | The token. NEP-141, 18 decimals, 1,000,000 at launch. |
| **Round** | A fixed window (10 minutes on testnet). Pledges go to the current round. |
| **Line** | What a round's pledges must reach. 1,000 EMBER at streak 0, plus 10% of that per streak level, at most 3×. |
| **Pledge** | EMBER thrown on the fire. It sits in escrow until the round closes. |
| **Roar** | A round whose pledges reached the line. Pledges burn; the spark pool is minted to pledgers. |
| **Spark pool** | 150% of the line, shared pro rata among a roaring round's pledgers. |
| **Out** | A round with pledges that fell short. 50% of each pledge burns as ash, the rest is refunded, 2% of the treasury burns. |
| **Ash** | The part of a pledge that burns when the fire goes out. |
| **Cold** | A round nobody pledged in. Only the streak resets. |
| **Streak** | Roaring rounds in a row. The community's high score; it also raises the line. |
| **Warmth** | Non-transferable reputation: every EMBER an account pledged in a roaring round, credited when it claims. |
| **Drip** | The one-time 100 EMBER grant a new account can take from the treasury. |
| **Treasury** | The 70% of supply held by the contract. Only drips and burns move it. |
| **Council** | The Sputnik DAO holding 30% of supply. It pays and admits members by warmth. |
| **Keeper** | An agent with its own NEAR sub-account that plays rounds by a strategy. |
| **Closer** | A keeper strategy that wakes late and fills the remaining gap, up to a quarter of the line. |
