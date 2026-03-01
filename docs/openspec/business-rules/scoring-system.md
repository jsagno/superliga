# Scoring System

This document defines scoring rules translated from the official Spanish regulation.

## War Daily Duels (Clan War)

Points awarded per duel result:

- Win 2-0: 4 points
- Win 2-1: 3 points
- Lose 1-2: 1 point
- Lose 0-2: 0 points

## Team League (Main Team Competition)

### Daily Format

- Each team plays one daily duel per player.

### Daily Points

- Duel win (2-0 or 2-1): 1 point
- Duel loss (0-2): 0 points

At the end of the day, the team with the most daily wins earns 1 bonus point.
If tied, all tied teams receive the bonus point.

### Rounds and Dates

For daily points visualization and round grouping, seasons use configurable
`days_per_round` (default: 4) defined per season.

- Round number is computed by date index and `days_per_round`.
- Final rounds may be partial if remaining dates are fewer than `days_per_round`.

### Consecutive Miss Penalties (Daily Points)

If a player has a scheduled daily duel date and does not complete it, penalties
apply by consecutive streak:

- 1st consecutive miss: `-1`
- 2nd consecutive miss: `-2`
- 3rd consecutive miss: `-5`
- 4th+ consecutive miss: `-10`

Rules:

- Streak resets when the player completes a daily duel with result.
- Only dates within the player's active window (`start_date`/`end_date`) apply.
- Future dates do not count toward penalties.
- Players are removed from the daily points grid after 4 consecutive misses.

### Team League Cup Points

At the end of each round, teams are ranked by accumulated points.
Cup points are awarded as follows:

Rounds 1 to 3:

- 1st: +6
- 2nd: +4
- 3rd: +2
- 4th: +1
- 5th: 0
- 6th: -1

Round 4 (final):

- 1st: +10
- 2nd: +6
- 3rd: +4
- 4th: +2
- 5th: 0
- 6th: -2

### Tie Breakers (Any Position)

If teams are tied in the Team League Cup, break ties in order:

1. Total duel points of each participant in the round.
2. Sum of player rankings for the team (lower sum wins).

## Rankings Influence

Player ranking is influenced by:

- Cups won.
- Points earned in leagues and competitions.
- Historical performance.

## Team Cup (Aggregate)

- The Team Cup is the sum of points from all competitions, leagues, and strategic bets.
- Points awarded in each competition roll up into the Team Cup standings.

## Captain League (Cup)

- Played in four rounds of four days each.
- Each captain selects one helper for a full round.
- Only the captain + helper scores count for the cup.
- Team Cup points awarded at the end:
	- 1st: +10
	- 2nd: +5
	- 3rd: +2
	- 4th: -1

## Doubles League (2v2 Cup)

- Round-robin among four teams (three dates).
- Best-of-three order: Normal 2v2, Touch 2v2, Normal 2v2.
- Match scoring:
	- Win 2-0: 4 points
	- Win 2-1: 3 points
	- Lose 1-2: 1 point
	- Lose 0-2: 0 points
- Final standings decide Team Cup points:
	- 1st: +10
	- 2nd: +5
	- 3rd: +2
	- 4th: -1

## Warriors Cup

- Played across three clan war dates (Thursday to Sunday).
- Each date, the captain selects a helper (no repeats).
- Score equals war points from the captain + helper.
- Team Cup points per date:
	- 1st: +6
	- 2nd: +3
	- 3rd: +1
	- 4th: -1

## Individual Cups and Leagues

### Qualifiers

- 20 players, single elimination, best-of-three.
- Winners advance to League Cup groups; losers to Revenge Cup groups.
- Each match adds points to the Individual League using the War Daily Duels scoring scheme.

### League Cup

- Group stage: two groups of five, round-robin best-of-three.
- Semifinals: best-of-three.
	- 2-0 win: 5 points to winner, 0 to loser.
	- 2-1 win: 5 points to winner, 2 to loser.
- Final: best-of-five.
	- 3-0 win: 6 points to winner, 0 to loser.
	- 3-1 win: 6 points to winner, 3 to loser.
	- 3-2 win: 6 points to winner, 4 to loser.
- Third-place match: best-of-five, points follow the War Daily Duels scheme.
- Team Cup points awarded:
	- 1st: +10
	- 2nd: +5
	- 3rd: +2

### Revenge Cup

- Final: best-of-five.
	- 3-0 win: 6 points to winner, 0 to loser.
	- 3-1 win: 6 points to winner, 3 to loser.
	- 3-2 win: 6 points to winner, 4 to loser.
- Third-place match: best-of-five, points follow the War Daily Duels scheme.
- Team Cup points awarded:
	- 1st: +10
	- 2nd: +5
	- 3rd: +2

### War Placement (Individual League)

At the end of each clan war (Thursday to Sunday), players receive:

- 1st: +3
- 2nd: +2
- 3rd: +1
- 20th: -3
- 19th: -2
- 18th: -1

### Individual Leagues (A, B, C)

Individual League points include:

- Daily duel points (War Daily Duels scheme).
- League Cup and Revenge Cup match points.
- War placement points.

League champions award Team Cup points:

- League A: 1st +10, 2nd +6, 3rd +3
- League B: 1st +6, 2nd +3, 3rd +1
- League C: 1st +3, 2nd +1

## Strategic Bets (Post-Draft)

### Joker Bet

- Captains select one competition their team is likely to win.
- Outcomes:
	- If the team wins the chosen competition: +4 Team Cup points.
	- If the team finishes last in that competition: -4 Team Cup points.
	- If the team wins a Joker-marked competition: +8 Team Cup points.

### Bomb Bet

- Captains can place a Bomb on the team ahead of them in rankings.
- The bomb targets a specific competition where that team is expected to finish last.
- Outcomes:
	- If the target finishes last: the target loses 4 Team Cup points.
	- If the target does not finish last: no effect.
	- If the target wins the competition: bomb deactivates and the target gains +4 Team Cup points.

## Team Ranking Basis

- Team ranking is the sum of individual player points (for example: 1st = 30 points, 2nd = 15 points).
- This ranking determines comparative ordering and enables Bomb bets.
