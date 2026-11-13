use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

const T0_MS: u64 = 1_794_600_000_000;
const ROUND_MS: u64 = 600_000;

fn acct(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn e(n: u128) -> u128 {
    n * ONE
}

fn params() -> Params {
    Params {
        round_secs: 600,
        base_line: U128(e(1_000)),
        line_step_bps: 1_000,
        max_line_multiple: 3,
        spark_bps: 15_000,
        ash_bps: 5_000,
        treasury_burn_bps: 200,
        min_pledge: U128(e(1)),
        drip: U128(e(100)),
        drip_budget: U128(e(100_000)),
    }
}

/// Sets who is calling, when (ms since genesis), and the deposit.
fn at(who: &str, ms: u64, deposit: NearToken) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acct("fire.hearth.testnet"))
        .predecessor_account_id(acct(who))
        .block_timestamp((T0_MS + ms) * 1_000_000)
        .attached_deposit(deposit)
        .build());
}

fn yocto() -> NearToken {
    NearToken::from_yoctonear(1)
}

/// A hearth with `players` registered and funded from the council.
fn hearth(players: &[&str], each: u128) -> Hearth {
    at("deployer.testnet", 0, NearToken::from_near(0));
    let mut h = Hearth::new(params(), acct("council.testnet"), None);
    for p in players {
        at(p, 0, NearToken::from_millinear(10));
        h.storage_deposit(None, None);
        at("council.testnet", 0, yocto());
        h.ft_transfer(acct(p), U128(each), None);
    }
    h
}

fn bal(h: &Hearth, who: &str) -> u128 {
    h.ft_balance_of(acct(who)).0
}

#[test]
fn launch_mints_the_split_and_has_no_owner() {
    let h = hearth(&[], 0);
    assert_eq!(h.ft_total_supply().0, INITIAL_SUPPLY);
    assert_eq!(bal(&h, "fire.hearth.testnet"), TREASURY_SHARE);
    assert_eq!(bal(&h, "council.testnet"), COUNCIL_SHARE);
    assert_eq!(h.get_params(), &params());
    let s = h.get_state();
    assert_eq!((s.round, s.streak, s.line.0), (0, 0, e(1_000)));
}

#[derive(near_sdk::serde::Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct VecRound {
    pledges: Vec<String>,
    outcome: String,
    line: String,
    burned: String,
    treasury_burned: String,
    claims: Vec<String>,
    streak_after: u32,
    treasury_after: String,
}

/// Replays contract/tests/vector.json, written by the TypeScript rules engine
/// (packages/hearth/test/rules.test.ts). Both must agree to the last unit.
#[test]
fn agrees_with_the_typescript_rules_engine() {
    let rounds: Vec<VecRound> = near_sdk::serde_json::from_str(include_str!("../tests/vector.json")).unwrap();
    let players = ["p0.testnet", "p1.testnet", "p2.testnet"];
    let mut h = hearth(&players, e(10_000));
    for (r, v) in rounds.iter().enumerate() {
        let start = r as u64 * ROUND_MS + 1_000;
        for (i, amount) in v.pledges.iter().enumerate() {
            at(players[i], start + i as u64, yocto());
            h.pledge(U128(amount.parse().unwrap()));
        }
        // Next round: close and claim.
        let next = (r as u64 + 1) * ROUND_MS + 500;
        at("anyone.testnet", next, NearToken::from_near(0));
        h.close_rounds();
        let s = h.get_state();
        assert_eq!(s.streak, v.streak_after, "streak after round {r}");
        assert_eq!(s.treasury.0.to_string(), v.treasury_after, "treasury after round {r}");
        if v.outcome == "cold" {
            assert!(h.get_round(r as u64).is_none());
            continue;
        }
        let rec = h.get_round(r as u64).unwrap().clone();
        assert_eq!(outcome_name(rec.outcome), v.outcome, "outcome of round {r}");
        assert_eq!(rec.line.0.to_string(), v.line, "line of round {r}");
        assert_eq!(rec.burned.0.to_string(), v.burned, "burned in round {r}");
        assert_eq!(rec.treasury_burned.0.to_string(), v.treasury_burned, "treasury burned in round {r}");
        for (i, want) in v.claims.iter().enumerate() {
            at(players[i], next + 10 + i as u64, NearToken::from_near(0));
            let got = h.claim(r as u64);
            assert_eq!(got.0.to_string(), *want, "claim of player {i} in round {r}");
        }
    }
}

#[test]
fn escrow_and_supply_add_up_after_a_roar_and_a_failure() {
    let mut h = hearth(&["a.testnet", "b.testnet"], e(5_000));
    at("a.testnet", 1_000, yocto());
    h.pledge(U128(e(600)));
    at("b.testnet", 2_000, yocto());
    h.pledge(U128(e(400)));
    // Round 1 goes out: 300 pledged against a 1,100 line.
    at("a.testnet", ROUND_MS + 1_000, yocto());
    h.pledge(U128(e(300)));
    at("a.testnet", 2 * ROUND_MS + 1_000, NearToken::from_near(0));
    let got = h.claim_all();
    // 600/1000 of a 1,500 pool, plus half of 300 back.
    assert_eq!(got.0, e(900) + e(150));
    at("b.testnet", 2 * ROUND_MS + 2_000, NearToken::from_near(0));
    assert_eq!(h.claim_all().0, e(600));
    let s = h.get_state();
    assert_eq!(s.escrow.0, 0);
    assert_eq!(s.streak, 0);
    assert_eq!(s.rounds_roared, 1);
    assert_eq!(s.rounds_out, 1);
    // Everything that exists is accounted for.
    let held = bal(&h, "a.testnet") + bal(&h, "b.testnet") + bal(&h, "council.testnet") + bal(&h, "fire.hearth.testnet");
    assert_eq!(held, h.ft_total_supply().0);
    assert_eq!(h.ft_total_supply().0, INITIAL_SUPPLY - e(1_000) + e(1_500) - e(150) - s.total_burned.0 + e(1_000) + e(150));
    assert_eq!(h.get_warmth(acct("a.testnet")).0, e(600));
    assert_eq!(h.get_warmth(acct("b.testnet")).0, e(400));
}

#[test]
fn the_line_rises_with_the_streak_and_a_cold_round_resets_it() {
    let mut h = hearth(&["a.testnet"], e(50_000));
    for r in 0..3u64 {
        at("a.testnet", r * ROUND_MS + 1_000, yocto());
        let line = h.get_state().line.0;
        h.pledge(U128(line));
    }
    at("x.testnet", 3 * ROUND_MS + 1, NearToken::from_near(0));
    // The view already knows the streak before anyone closes the rounds.
    let s = h.get_state();
    assert_eq!((s.streak, s.line.0, s.needs_close), (3, e(1_300), true));
    h.close_rounds();
    assert_eq!(h.get_state().best_streak, 3);
    // Round 3 is cold; in round 4 the streak is back to 0.
    at("x.testnet", 4 * ROUND_MS + 1, NearToken::from_near(0));
    let s = h.get_state();
    assert_eq!((s.streak, s.line.0, s.best_streak), (0, e(1_000), 3));
}

#[test]
fn views_report_what_is_claimable() {
    let mut h = hearth(&["a.testnet"], e(5_000));
    at("a.testnet", 1_000, yocto());
    h.pledge(U128(e(1_000)));
    let c = h.get_claimable(acct("a.testnet"));
    assert_eq!((c.len(), c[0].status.as_str()), (1, "open"));
    at("a.testnet", ROUND_MS + 1, NearToken::from_near(0));
    h.close_rounds();
    let c = h.get_claimable(acct("a.testnet"));
    assert_eq!((c[0].status.as_str(), c[0].amount.0), ("roared", e(1_500)));
    assert_eq!(h.list_rounds(None, None).len(), 1);
    assert!(get_logs().iter().any(|l| l.contains(r#""event":"round_closed""#)));
}

#[test]
fn mul_div_is_exact_beyond_u128() {
    assert_eq!(mul_div(e(1_650), e(500), e(1_200) + 5), 687_499_999_999_999_999_997);
    assert_eq!(mul_div(u128::MAX, 3, 3), u128::MAX);
    assert_eq!(mul_div(u128::MAX, u128::MAX, u128::MAX), u128::MAX);
    assert_eq!(mul_div(7, 3, 2), 10);
}

#[test]
#[should_panic(expected = "this round is not closed yet")]
fn cannot_claim_an_open_round() {
    let mut h = hearth(&["a.testnet"], e(5_000));
    at("a.testnet", 1_000, yocto());
    h.pledge(U128(e(10)));
    h.claim(0);
}

#[test]
#[should_panic(expected = "nothing to claim for this round")]
fn cannot_claim_twice() {
    let mut h = hearth(&["a.testnet"], e(5_000));
    at("a.testnet", 1_000, yocto());
    h.pledge(U128(e(10)));
    at("a.testnet", ROUND_MS + 1, NearToken::from_near(0));
    h.claim(0);
    h.claim(0);
}

#[test]
#[should_panic(expected = "pledge is below min_pledge")]
fn pledges_have_a_minimum() {
    let mut h = hearth(&["a.testnet"], e(5_000));
    at("a.testnet", 1_000, yocto());
    h.pledge(U128(1));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn pledges_need_the_one_yocto_confirmation() {
    let mut h = hearth(&["a.testnet"], e(5_000));
    at("a.testnet", 1_000, NearToken::from_near(0));
    h.pledge(U128(e(10)));
}

#[test]
fn drip_registers_once_and_refunds_extra_deposit() {
    let mut h = hearth(&[], 0);
    at("new.testnet", 1_000, NearToken::from_millinear(50));
    assert_eq!(h.drip().0, e(100));
    assert_eq!(bal(&h, "new.testnet"), e(100));
    assert_eq!(h.get_state().drip_left.0, e(100_000) - e(100));
    assert_eq!(h.get_state().treasury.0, TREASURY_SHARE - e(100));
}

#[test]
#[should_panic(expected = "this account already took its drip")]
fn drip_is_once_per_account() {
    let mut h = hearth(&[], 0);
    at("new.testnet", 1_000, NearToken::from_millinear(50));
    h.drip();
    h.drip();
}

#[test]
#[should_panic(expected = "force unregister is disabled")]
fn force_unregister_is_disabled() {
    let mut h = hearth(&["a.testnet"], e(5));
    at("a.testnet", 1_000, yocto());
    h.storage_unregister(Some(true));
}
