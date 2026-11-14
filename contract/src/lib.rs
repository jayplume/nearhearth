//! NEAR Hearth: EMBER, a NEP-141 memecoin with a fire the community keeps alive.
//!
//! The rules are in RULES.md. In short: every round, holders `pledge` EMBER.
//! When the round closes, pledges that reach the line burn and a spark pool of
//! 150% of the line is minted back to the pledgers pro rata (the fire roars).
//! Pledges that fall short lose 50% as ash, the streak resets and 2% of the
//! treasury burns (the fire goes out). Nothing here has an owner: parameters
//! are fixed at `new`, and there is no method that can change them.

use near_contract_standards::fungible_token::events::{FtBurn, FtMint};
use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap, LookupSet, Vector};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue,
};

pub const BPS: u128 = 10_000;
const ONE: u128 = 1_000_000_000_000_000_000;
pub const INITIAL_SUPPLY: u128 = 1_000_000 * ONE;
pub const TREASURY_SHARE: u128 = 700_000 * ONE;
pub const COUNCIL_SHARE: u128 = 300_000 * ONE;
/// Rounds a single call may settle, so a call after a long pause still fits in gas.
const SETTLE_MAX: usize = 8;
const UNCLAIMED_MAX: usize = 24;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum Key {
    Token,
    Metadata,
    Pledged,
    Pledges,
    Closed,
    History,
    Unclaimed,
    Warmth,
    Dripped,
}

/// Fixed at launch. See RULES.md for what each one does.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Params {
    pub round_secs: u64,
    pub base_line: U128,
    pub line_step_bps: u32,
    pub max_line_multiple: u32,
    pub spark_bps: u32,
    pub ash_bps: u32,
    pub treasury_burn_bps: u32,
    pub min_pledge: U128,
    pub drip: U128,
    pub drip_budget: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Outcome {
    Roared,
    Out,
}

/// A round that had pledges, once closed. Rounds nobody pledged in are cold and only reset the streak.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct RoundRecord {
    pub round: u64,
    pub line: U128,
    pub pledged: U128,
    pub pledgers: u32,
    pub outcome: Outcome,
    /// Roared: the spark pool. Out: the total refundable.
    pub payout: U128,
    pub burned: U128,
    pub treasury_burned: U128,
    pub streak_after: u32,
    pub closed_block: u64,
}

#[near(serializers = [json])]
pub struct HearthState {
    pub round: u64,
    pub round_ends_ms: u64,
    pub line: U128,
    pub pledged: U128,
    pub pledgers: u32,
    pub streak: u32,
    pub best_streak: u32,
    pub treasury: U128,
    pub escrow: U128,
    pub total_supply: U128,
    pub total_burned: U128,
    pub total_minted: U128,
    pub drip_left: U128,
    pub rounds_roared: u32,
    pub rounds_out: u32,
    pub council: AccountId,
    /// True when an ended round is waiting for `close_rounds` (any call to pledge or claim also closes it).
    pub needs_close: bool,
}

#[near(serializers = [json])]
pub struct AccountView {
    pub account_id: AccountId,
    pub balance: U128,
    pub pledge: U128,
    pub warmth: U128,
}

#[near(serializers = [json])]
pub struct Claimable {
    pub round: u64,
    pub pledged: U128,
    /// "open", "roared" or "out".
    pub status: String,
    pub amount: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Hearth {
    token: FungibleToken,
    metadata: FungibleTokenMetadata,
    params: Params,
    council: AccountId,
    genesis_ms: u64,
    /// Every round before this one is closed.
    next_to_close: u64,
    streak: u32,
    best_streak: u32,
    /// Rounds with pledges that are not closed yet (at most the current one and the one before).
    pending: Vec<u64>,
    pledged: LookupMap<u64, (u128, u32)>,
    pledges: LookupMap<String, u128>,
    closed: LookupMap<u64, RoundRecord>,
    history: Vector<u64>,
    unclaimed: LookupMap<AccountId, Vec<u64>>,
    warmth: IterableMap<AccountId, u128>,
    dripped: LookupSet<AccountId>,
    drip_left: u128,
    /// EMBER in the contract's balance that belongs to pledgers: open pledges and unclaimed refunds.
    escrow: u128,
    total_burned: u128,
    total_minted: u128,
    rounds_roared: u32,
    rounds_out: u32,
}

fn emit(event: &str, data: String) {
    env::log_str(&format!(r#"EVENT_JSON:{{"standard":"nearhearth","version":"1.0.0","event":"{event}","data":[{data}]}}"#));
}

/// floor(a × b / c) with a 256-bit intermediate, so 18-decimal amounts never overflow. Requires a × b / c < 2^128.
pub fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    require!(c > 0, "division by zero");
    let (hi, lo) = mul_wide(a, b);
    require!(hi < c, "mul_div overflow");
    let mut rem = hi;
    let mut q: u128 = 0;
    for i in (0..128).rev() {
        let carry = rem >> 127;
        rem = (rem << 1) | ((lo >> i) & 1);
        if carry == 1 || rem >= c {
            rem = rem.wrapping_sub(c);
            q |= 1 << i;
        }
    }
    q
}

fn mul_wide(a: u128, b: u128) -> (u128, u128) {
    let mask = u64::MAX as u128;
    let (a1, a0) = (a >> 64, a & mask);
    let (b1, b0) = (b >> 64, b & mask);
    let p00 = a0 * b0;
    let p01 = a0 * b1;
    let p10 = a1 * b0;
    let p11 = a1 * b1;
    let mid = (p00 >> 64) + (p01 & mask) + (p10 & mask);
    let lo = (p00 & mask) | (mid << 64);
    let hi = p11 + (p01 >> 64) + (p10 >> 64) + (mid >> 64);
    (hi, lo)
}

fn bps(x: u128, b: u32) -> u128 {
    x * b as u128 / BPS
}

#[near]
impl Hearth {
    /// Launch. Mints the whole initial supply: 70% to the treasury (this contract), 30% to the council DAO.
    #[init]
    pub fn new(params: Params, council: AccountId, icon: Option<String>) -> Self {
        require!(params.round_secs >= 60, "round_secs must be at least 60");
        require!(params.base_line.0 > 0 && params.min_pledge.0 > 0, "line and min_pledge must be positive");
        require!(params.max_line_multiple >= 1, "max_line_multiple must be at least 1");
        require!(params.spark_bps > 0 && params.ash_bps <= BPS as u32 && params.treasury_burn_bps <= 1_000, "bps out of range");
        require!(params.drip_budget.0 <= TREASURY_SHARE, "drip budget exceeds the treasury");
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Ember".to_string(),
            symbol: "EMBER".to_string(),
            icon,
            reference: None,
            reference_hash: None,
            decimals: 18,
        };
        metadata.assert_valid();
        let mut token = FungibleToken::new(Key::Token);
        let me = env::current_account_id();
        token.internal_register_account(&me);
        token.internal_register_account(&council);
        token.internal_deposit(&me, TREASURY_SHARE);
        token.internal_deposit(&council, COUNCIL_SHARE);
        FtMint { owner_id: &me, amount: U128(TREASURY_SHARE), memo: Some("treasury") }.emit();
        FtMint { owner_id: &council, amount: U128(COUNCIL_SHARE), memo: Some("council") }.emit();
        let drip_left = params.drip_budget.0;
        Self {
            token,
            metadata,
            params,
            council,
            genesis_ms: env::block_timestamp_ms(),
            next_to_close: 0,
            streak: 0,
            best_streak: 0,
            pending: vec![],
            pledged: LookupMap::new(Key::Pledged),
            pledges: LookupMap::new(Key::Pledges),
            closed: LookupMap::new(Key::Closed),
            history: Vector::new(Key::History),
            unclaimed: LookupMap::new(Key::Unclaimed),
            warmth: IterableMap::new(Key::Warmth),
            dripped: LookupSet::new(Key::Dripped),
            drip_left,
            escrow: 0,
            total_burned: 0,
            total_minted: 0,
            rounds_roared: 0,
            rounds_out: 0,
        }
    }

    // ---------- the game ----------

    /// Throw EMBER on the fire for the current round. Attach 1 yoctoNEAR (wallet confirmation, as for ft_transfer).
    #[payable]
    pub fn pledge(&mut self, amount: U128) -> U128 {
        assert_one_yocto();
        self.settle();
        let who = env::predecessor_account_id();
        let amount = amount.0;
        require!(amount >= self.params.min_pledge.0, "pledge is below min_pledge");
        let round = self.current_round();
        let me = env::current_account_id();
        self.token.internal_transfer(&who, &me, amount, Some("pledge".to_string()));
        self.escrow += amount;
        let key = format!("{round}:{who}");
        let before = self.pledges.get(&key).copied().unwrap_or(0);
        let (total, count) = self.pledged.get(&round).copied().unwrap_or((0, 0));
        let count = if before == 0 { count + 1 } else { count };
        self.pledged.insert(round, (total + amount, count));
        self.pledges.insert(key, before + amount);
        if before == 0 {
            let mut list = self.unclaimed.get(&who).cloned().unwrap_or_default();
            require!(list.len() < UNCLAIMED_MAX, "claim your earlier rounds first (claim_all)");
            list.push(round);
            self.unclaimed.insert(who.clone(), list);
        }
        if !self.pending.contains(&round) {
            self.pending.push(round);
        }
        emit(
            "pledge",
            format!(r#"{{"round":{round},"account_id":"{who}","amount":"{amount}","round_total":"{}","line":"{}"}}"#, total + amount, self.line_for(self.streak)),
        );
        U128(before + amount)
    }

    /// Close every round that has ended. Anyone can call it; pledge and claim call it too.
    pub fn close_rounds(&mut self) -> u64 {
        self.settle();
        self.next_to_close
    }

    /// Collect sparks (roared) or the refund (out) for one closed round you pledged in.
    pub fn claim(&mut self, round: u64) -> U128 {
        self.settle();
        let who = env::predecessor_account_id();
        U128(self.claim_one(&who, round))
    }

    /// Claim every closed round you pledged in. Returns the total received.
    pub fn claim_all(&mut self) -> U128 {
        self.settle();
        let who = env::predecessor_account_id();
        let rounds: Vec<u64> = self.unclaimed.get(&who).cloned().unwrap_or_default();
        let mut sum = 0;
        let closed_before = self.next_to_close;
        for r in rounds.into_iter().filter(|r| *r < closed_before) {
            sum += self.claim_one(&who, r);
        }
        U128(sum)
    }

    /// One-time starter grant of `drip` EMBER from the treasury. Attach the storage deposit if the account is new.
    #[payable]
    pub fn drip(&mut self) -> U128 {
        let who = env::predecessor_account_id();
        require!(!self.dripped.contains(&who), "this account already took its drip");
        let amount = self.params.drip.0;
        require!(self.drip_left >= amount, "the drip budget is spent");
        let mut deposit = env::attached_deposit();
        if !self.token.accounts.contains_key(&who) {
            let min = self.token.storage_balance_bounds().min;
            require!(deposit >= min, "attach the storage deposit (storage_balance_bounds.min) to register");
            self.token.internal_register_account(&who);
            deposit = deposit.saturating_sub(min);
        }
        self.dripped.insert(who.clone());
        self.drip_left -= amount;
        self.token.internal_transfer(&env::current_account_id(), &who, amount, Some("drip".to_string()));
        emit("drip", format!(r#"{{"account_id":"{who}","amount":"{amount}"}}"#));
        if !deposit.is_zero() {
            near_sdk::Promise::new(who).transfer(deposit).detach();
        }
        U128(amount)
    }

    // ---------- views ----------

    pub fn get_params(&self) -> &Params {
        &self.params
    }

    pub fn get_state(&self) -> HearthState {
        let round = self.current_round();
        let streak = self.effective_streak();
        let (pledged, pledgers) = self.pledged.get(&round).copied().unwrap_or((0, 0));
        HearthState {
            round,
            round_ends_ms: self.genesis_ms + (round + 1) * self.params.round_secs * 1000,
            line: U128(self.line_for(streak)),
            pledged: U128(pledged),
            pledgers,
            streak,
            best_streak: self.best_streak.max(streak),
            treasury: U128(self.treasury()),
            escrow: U128(self.escrow),
            total_supply: U128(self.token.total_supply),
            total_burned: U128(self.total_burned),
            total_minted: U128(self.total_minted),
            drip_left: U128(self.drip_left),
            rounds_roared: self.rounds_roared,
            rounds_out: self.rounds_out,
            council: self.council.clone(),
            needs_close: self.pending.iter().any(|r| *r < round),
        }
    }

    pub fn get_round(&self, round: u64) -> Option<&RoundRecord> {
        self.closed.get(&round)
    }

    /// Closed rounds that had pledges, newest first.
    pub fn list_rounds(&self, from: Option<u32>, limit: Option<u32>) -> Vec<&RoundRecord> {
        let len = self.history.len();
        let limit = limit.unwrap_or(20).min(100);
        (0..len)
            .rev()
            .skip(from.unwrap_or(0) as usize)
            .take(limit as usize)
            .filter_map(|i| self.history.get(i).and_then(|r| self.closed.get(r)))
            .collect()
    }

    pub fn get_pledge(&self, round: u64, account_id: AccountId) -> U128 {
        U128(self.pledges.get(&format!("{round}:{account_id}")).copied().unwrap_or(0))
    }

    /// What an account can still collect, round by round.
    pub fn get_claimable(&self, account_id: AccountId) -> Vec<Claimable> {
        let rounds = self.unclaimed.get(&account_id).cloned().unwrap_or_default();
        rounds
            .into_iter()
            .map(|r| {
                let mine = self.pledges.get(&format!("{r}:{account_id}")).copied().unwrap_or(0);
                match self.closed.get(&r) {
                    Some(rec) => Claimable { round: r, pledged: U128(mine), status: outcome_name(rec.outcome), amount: U128(self.payout(rec, mine)) },
                    None => Claimable { round: r, pledged: U128(mine), status: "open".into(), amount: U128(0) },
                }
            })
            .collect()
    }

    /// Balance, pledge in `round` and warmth for many accounts in one call (the site reads the whole swarm with it).
    pub fn get_accounts(&self, account_ids: Vec<AccountId>, round: u64) -> Vec<AccountView> {
        require!(account_ids.len() <= 50, "at most 50 accounts per call");
        account_ids
            .into_iter()
            .map(|a| AccountView {
                balance: U128(self.token.accounts.get(&a).unwrap_or(0)),
                pledge: U128(self.pledges.get(&format!("{round}:{a}")).copied().unwrap_or(0)),
                warmth: U128(self.warmth.get(&a).copied().unwrap_or(0)),
                account_id: a,
            })
            .collect()
    }

    /// The line a round needs at a given streak (the schedule is fixed at launch).
    pub fn get_line_for(&self, streak: u32) -> U128 {
        U128(self.line_for(streak))
    }

    pub fn has_dripped(&self, account_id: AccountId) -> bool {
        self.dripped.contains(&account_id)
    }

    pub fn get_warmth(&self, account_id: AccountId) -> U128 {
        U128(self.warmth.get(&account_id).copied().unwrap_or(0))
    }

    /// Every account with warmth, in no particular order (the site sorts).
    pub fn list_warmth(&self, from: Option<u32>, limit: Option<u32>) -> Vec<(AccountId, U128)> {
        self.warmth
            .iter()
            .skip(from.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(200) as usize)
            .map(|(a, w)| (a.clone(), U128(*w)))
            .collect()
    }

    // ---------- internals ----------

    fn current_round(&self) -> u64 {
        (env::block_timestamp_ms() - self.genesis_ms) / (self.params.round_secs * 1000)
    }

    fn line_for(&self, streak: u32) -> u128 {
        let p = &self.params;
        let steps = streak as u128 * p.line_step_bps as u128;
        let cap = (p.max_line_multiple as u128 - 1) * BPS;
        p.base_line.0 * (BPS + steps.min(cap)) / BPS
    }

    fn treasury(&self) -> u128 {
        self.token.accounts.get(&env::current_account_id()).unwrap_or(0) - self.escrow
    }

    /// The streak as it will be once every ended round is closed, without writing anything.
    fn effective_streak(&self) -> u32 {
        let now = self.current_round();
        let mut streak = self.streak;
        let mut next = self.next_to_close;
        let mut rounds: Vec<u64> = self.pending.iter().copied().filter(|r| *r < now).collect();
        rounds.sort_unstable();
        for r in rounds {
            if r > next {
                streak = 0;
            }
            let (total, _) = self.pledged.get(&r).copied().unwrap_or((0, 0));
            streak = if total >= self.line_for(streak) { streak + 1 } else { 0 };
            next = r + 1;
        }
        if next < now {
            streak = 0;
        }
        streak
    }

    fn settle(&mut self) {
        let now = self.current_round();
        if self.next_to_close >= now {
            return;
        }
        let mut due: Vec<u64> = self.pending.iter().copied().filter(|r| *r < now).collect();
        due.sort_unstable();
        for r in due.into_iter().take(SETTLE_MAX) {
            if r > self.next_to_close {
                self.streak = 0; // cold rounds in between
            }
            self.close(r);
            self.next_to_close = r + 1;
            self.pending.retain(|p| *p != r);
        }
        if self.pending.iter().all(|r| *r >= now) {
            if self.next_to_close < now {
                self.streak = 0; // trailing cold rounds
            }
            self.next_to_close = now;
        }
    }

    fn close(&mut self, round: u64) {
        let (pledged, pledgers) = self.pledged.get(&round).copied().unwrap_or((0, 0));
        let line = self.line_for(self.streak);
        let me = env::current_account_id();
        let (outcome, payout, burned, tb) = if pledged >= line {
            self.token.internal_withdraw(&me, pledged);
            self.escrow -= pledged;
            self.streak += 1;
            self.best_streak = self.best_streak.max(self.streak);
            self.rounds_roared += 1;
            (Outcome::Roared, bps(line, self.params.spark_bps), pledged, 0)
        } else {
            let refunds = pledged * (BPS - self.params.ash_bps as u128) / BPS;
            let ash = pledged - refunds;
            self.token.internal_withdraw(&me, ash);
            self.escrow -= ash;
            let tb = bps(self.treasury(), self.params.treasury_burn_bps);
            self.token.internal_withdraw(&me, tb);
            self.streak = 0;
            self.rounds_out += 1;
            (Outcome::Out, refunds, ash, tb)
        };
        self.total_burned += burned + tb;
        if burned > 0 {
            FtBurn { owner_id: &me, amount: U128(burned), memo: Some(if outcome == Outcome::Roared { "logs" } else { "ash" }) }.emit();
        }
        if tb > 0 {
            FtBurn { owner_id: &me, amount: U128(tb), memo: Some("treasury") }.emit();
        }
        let rec = RoundRecord {
            round,
            line: U128(line),
            pledged: U128(pledged),
            pledgers,
            outcome,
            payout: U128(payout),
            burned: U128(burned),
            treasury_burned: U128(tb),
            streak_after: self.streak,
            closed_block: env::block_height(),
        };
        emit(
            "round_closed",
            format!(
                r#"{{"round":{round},"outcome":"{}","line":"{line}","pledged":"{pledged}","payout":"{payout}","burned":"{burned}","treasury_burned":"{tb}","streak":{}}}"#,
                outcome_name(outcome),
                self.streak
            ),
        );
        self.closed.insert(round, rec);
        self.history.push(round);
        // The record keeps the total; the running total for an open round is no longer needed.
        self.pledged.remove(&round);
    }

    fn payout(&self, rec: &RoundRecord, mine: u128) -> u128 {
        match rec.outcome {
            Outcome::Roared => mul_div(rec.payout.0, mine, rec.pledged.0),
            Outcome::Out => mine * (BPS - self.params.ash_bps as u128) / BPS,
        }
    }

    fn claim_one(&mut self, who: &AccountId, round: u64) -> u128 {
        require!(round < self.next_to_close, "this round is not closed yet");
        let key = format!("{round}:{who}");
        let mine = self.pledges.remove(&key).unwrap_or_else(|| env::panic_str("nothing to claim for this round"));
        let rec = self.closed.get(&round).cloned().unwrap_or_else(|| env::panic_str("round record missing"));
        let amount = self.payout(&rec, mine);
        let me = env::current_account_id();
        let warmth = match rec.outcome {
            Outcome::Roared => {
                if amount > 0 {
                    self.token.internal_deposit(who, amount);
                    self.total_minted += amount;
                    FtMint { owner_id: who, amount: U128(amount), memo: Some("sparks") }.emit();
                }
                let w = self.warmth.get(who).copied().unwrap_or(0) + mine;
                self.warmth.insert(who.clone(), w);
                mine
            }
            Outcome::Out => {
                if amount > 0 {
                    self.token.internal_transfer(&me, who, amount, Some("refund".to_string()));
                    self.escrow -= amount;
                }
                0
            }
        };
        let mut list = self.unclaimed.get(who).cloned().unwrap_or_default();
        list.retain(|r| *r != round);
        if list.is_empty() {
            self.unclaimed.remove(who);
        } else {
            self.unclaimed.insert(who.clone(), list);
        }
        emit(
            "claim",
            format!(r#"{{"round":{round},"account_id":"{who}","outcome":"{}","amount":"{amount}","warmth":"{warmth}"}}"#, outcome_name(rec.outcome)),
        );
        amount
    }
}

fn outcome_name(o: Outcome) -> String {
    match o {
        Outcome::Roared => "roared".into(),
        Outcome::Out => "out".into(),
    }
}

// ---------- NEP-141, NEP-145, NEP-148 ----------

#[near]
impl FungibleTokenCore for Hearth {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Hearth {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 {
            FtBurn { owner_id: &sender_id, amount: U128(burned), memo: Some("unregistered") }.emit();
        }
        used.into()
    }
}

#[near]
impl StorageManagement for Hearth {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        require!(force != Some(true), "force unregister is disabled: it would burn pledges and break the escrow");
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Hearth {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }
}

#[cfg(test)]
mod tests;
