# V2.2 plan-generation research — canonical source report

**Audience:** Ian and the V2.2 plan-engine implementation team  
**Date:** 2026-09-05  
**Scope:** Public McMillan methodology, other professional plan architectures, and peer-reviewed evidence relevant to 5K, 10K, half-marathon, and marathon generation.  
**Exclusions:** No paid-plan access, paywall bypass, verbatim reproduction of commercial schedules, medical diagnosis, ultra plans, strength-plan implementation, or application-code changes.

## Executive answer

V2.2 should not contain one stretched 5K curve. It needs distance-specific race blocks selected from the runner's demonstrated starting capacity. Public McMillan material supports two entry paths:

1. **First-timer path:** 12–16 weeks for 5K/10K and 16–20 weeks for half/marathon.
2. **Prepared-runner race block:** 8–12 weeks for 5K/10K and 12–16 weeks for half/marathon, only when recent weekly volume and longest-run capacity meet the selected level's prerequisites.

The generator should preserve a low-intensity majority, separate demanding sessions with easy/rest days, progress toward race-specific work, taper by reducing volume while retaining small intensity exposures, and initialize from recent training rather than desired goal time. Exact weekly-growth, deload, and long-run-share percentages are coaching policies: current science does not establish universal values.

## Material findings

### McMillan's public system

- Current plan catalogues use Levels 0–5. Level is selected with run frequency, weekly volume, normal-run duration, long-run duration, and ability to tolerate specialty workouts.
- McMillan also distinguishes **Speedster**, **Combo**, and **Endurance Monster** using relative short- versus long-distance strengths and fatigue response.
- Race plans can be preceded by recovery, base, hills, stamina, or speed modules. The final race plan is not expected to carry every possible preparatory phase when the runner already completed them.
- Common rhythm: one specialty session for novices; one or two for intermediate runners; two for advanced runners; easy/recovery running around them; and one long run.
- McMillan's public marathon guide recommends a down week every third or fourth week at roughly 15–25% lower load. This conflicts with V2.2's present 35–45% rule, which came from Ian's imported examples and later ruling.
- McMillan's 5K/10K method balances endurance, threshold/stamina, speed/VO2, goal-pace practice, leg speed, and a small sprint dose. The 5K leans faster; the 10K gives threshold and longer race-pace repetitions more weight.
- Half-marathon emphasis changes with expected duration. Threshold matters for all; durability and fueling matter more beyond roughly 90 minutes.
- Marathon-specific work emphasizes sustainable mileage, long-run durability, goal-pace practice, fueling rehearsal, and—within the last 8–10 weeks—alternating easy long runs with selected fast-finish/goal-pace long runs.
- McMillan's peaking model reduces volume and long-run length for the final 10–14 days while preserving frequency and small fast-running exposures.

### Independent professional examples

- Athletics Ireland's intermediate 5K–10K example uses a 15-week sequence: aerobic base/fartlek, strength/speed, race-specific sharpening, then taper, with step-back weeks.
- B.A.A.'s half-marathon examples use a 2-week preparation phase, a 9-week main phase, and a 1-week taper, with level-specific frequency and difficulty.
- B.A.A.'s marathon architecture uses 20 weeks: 3 preparation, 6 build, 9 marathon-specific, and 2 taper, with frequency, weekly volume, and long-run ceiling increasing by level.
- Daniels' public material supports an easy-running/strides base, followed by economy/repetition, interval, and threshold work, while retaining a weekly long run and backing off when soreness, injury, fatigue, or life stress rises.
- Pfitzinger's public marathon plans scale by current mileage and experience, use recovery weeks and hard/easy sequencing, and commonly taper across three weeks.

### Peer-reviewed evidence

- A running-specific systematic review supports a low-intensity majority: at least about 70% low intensity and no more than about 30% threshold/high intensity as a broad organizing principle, not an exact prescription for every runner.
- Taper meta-analysis supports reducing volume about 41–60% while maintaining intensity and frequency across up to 21 days; the strongest general effect appeared around 8–14 days.
- Observational data from more than 158,000 recreational marathoners associated disciplined 3-week tapers with better outcomes than minimal tapers. This supports allowing 2–3 weeks for marathon rather than forcing every distance into one taper.
- A 5,205-runner cohort found greater overuse-injury rates when a single session exceeded the runner's longest run in the previous 30 days by more than 10%. Week-to-week volume ratios did not show the same association. This justifies collecting recent-longest-run data and guarding single-session spikes.
- Reviews find inconsistent evidence for one universal weekly-volume progression rule. The common weekly “10% rule” should not be described as medically proven.
- Prior injury is one of the most consistent injury-risk signals. Current pain or unfinished rehabilitation should materially reduce aggressiveness and prompt professional evaluation language.
- A half/marathon cohort associated higher training volumes and longer endurance runs with performance, but did not establish universal injury-safe long-run percentages. Long-run caps must combine recent longest run, time/distance, weekly volume, experience, and recovery status.

## Reconciled generator policy

### High-confidence rules

- Generate from **current demonstrated capacity**, not target ambition alone.
- Keep at least 70% of running easy for established runners; novices should be even more conservative.
- Novice: no more than one true quality session weekly. Established: normally one or two. A quality long run counts as a quality session.
- Place an easy or rest day between demanding sessions.
- Use distance-specific race work; do not stretch one 5K plan.
- Reduce volume into the race while retaining brief intensity.
- Never increase a proposed single-run distance beyond the runner's longest run in the previous 30 days without an explicit conservative ramp.
- Injury history and current pain must change the result.

### Coaching-policy rules requiring Ian's approval

- Down-week cadence: every third or fourth week.
- Down-week reduction: public McMillan 15–25% versus V2.2's current 35–45%.
- Maximum long-run share of weekly volume: no universal research-backed percentage exists.
- Absolute maximum long-run duration: McMillan sometimes permits up to 4 hours for marathoners; V2.2 currently caps at 3 hours.
- Exact weekly-volume curve and experience-level ceilings.
- When to classify a long run containing goal pace as the week's first or second quality session.

## Limitations

- Coaching plan pages describe successful systems but are not controlled trials proving that their exact schedules are optimal.
- Several public sources prohibit reproduction or repurposing of their schedules. This report summarizes architecture only.
- Many research findings come from trained adults or observational data; they do not justify direct transfer to youth, current injury, pregnancy, or clinical populations.
- There is no public McMillan algorithm for assigning Speedster/Combo/Endurance Monster or for modifying every workout by type.
- Research supports principles more strongly than exact plan numbers.

## Claim-to-source ledger

| Claim | Source | Publisher/author | Date | URL | Access notes |
|---|---|---|---|---|---|
| McMillan levels, durations, prerequisites | 5K, 10K, half and marathon plan catalogues | McMillan Running | Accessed 2026-09-05 | https://www.mcmillanrunning.com/training-plans/ | Public catalogue; commercial schedules not accessed |
| 5K workout architecture | 5K Training Plan Guide + free guide | Greg McMillan | Public PDF path 2026 | https://cdn.mcmillanrunning.com/wp-content/uploads/2026/01/5K-Guide-Final.pdf | Public PDF; summarized only |
| 10K workout progression | 10K Training Plan Guide; The Best 10K Workout | Greg McMillan | c. 2020 / public | https://www.mcmillanrunning.com/10k-training-plan-guide/ | Public article |
| Half-marathon factors and duration | Half-Marathon Training Plan Guide | Greg McMillan | c. 2020 | https://www.mcmillanrunning.com/half-marathon-training-plan-guide/ | Public article |
| Marathon components, down weeks, long runs | Marathon Training Plan Guide | Greg McMillan | c. 2020 | https://www.mcmillanrunning.com/marathon-training-plan-guide/ | Public article |
| McMillan marathon long-run variations | 5 Proven Marathon Long Runs | Greg McMillan | c. 2016 | https://www.mcmillanrunning.com/5-proven-marathon-long-runs/ | Public article |
| B.A.A. marathon architecture | Boston Marathon Training | Boston Athletic Association | Accessed 2026-09-05 | https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/ | Copyrighted schedule; architecture summarized only |
| B.A.A. half architecture | Boston Half Training | Boston Athletic Association | Accessed 2026-09-05 | https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/ | Explicit no-repurpose notice |
| Professional 5K–10K periodization example | Intermediate Runner's 15 Week Training Plan | Athletics Ireland / Irene Clark | 2025 | https://www.athleticsireland.ie/wp-content/uploads/2025/04/Training-Plan-3-Intermediate-Runners-Final.pdf | Public governing-body PDF |
| Low-intensity majority | Training-intensity Distribution on Middle- and Long-distance Runners | Campos et al. | 2022 | https://pubmed.ncbi.nlm.nih.gov/34749417/ | Systematic review, 20 studies |
| Endurance taper | Effects of tapering on performance in endurance athletes | Wang et al. | 2023 | https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/ | Systematic review/meta-analysis |
| Recreational marathon taper | Longer Disciplined Tapers Improve Marathon Performance | Smyth & Lawlor | 2021 | https://pubmed.ncbi.nlm.nih.gov/34651125/ | Observational, >158,000 runners |
| Single-session distance spikes | How much running is too much? | Frandsen et al. | 2025 | https://pubmed.ncbi.nlm.nih.gov/40623829/ | Prospective cohort, 5,205 adults |
| Weekly progression uncertainty | Association Between Running Injuries and Training Parameters | Fredette et al. | 2022 | https://pubmed.ncbi.nlm.nih.gov/34478518/ | Systematic review, 36 studies |
| Prior injury | Risk factors for overuse injuries in short- and long-distance running | van Poppel et al. | 2021 | https://pubmed.ncbi.nlm.nih.gov/32535271/ | Systematic review |
| Half/marathon volume and long runs | Training for a (half-)marathon | Fokkema et al. | 2020 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7496388/ | Prospective observational cohort |

## Research stop rationale

The four distance slots have current public McMillan coverage, independent professional examples, and peer-reviewed support for every consequential shared principle. Remaining gaps concern exact coaching-policy values that additional generic web searching cannot resolve. Those need Ian's judgment or licensed course material, not more low-specificity sources.
