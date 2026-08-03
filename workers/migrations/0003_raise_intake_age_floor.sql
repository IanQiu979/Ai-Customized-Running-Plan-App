-- Raise the intake age floor from 10 to 13 (2026-08-03).
--
-- The captain ruled V2.2's minimum accepted intake age is 13: the one number that
-- simultaneously clears Apple's App Store 9+ rating floor for exercise-recommendation apps
-- (no downward override), clears COPPA's under-13 verifiable-parental-consent line, and matches
-- Texas SB2420's lowest legally-defined age band. See the scout report
-- `v22-apple-kids-guidelines-research-s1` §6.4/§6.5.
--
-- `routes.ts`'s validator now rejects age < 13, but that layer is only a readable-message gate:
-- the table CHECK is the real gate "cannot be bypassed by a future caller that forgets to use
-- this route" (`routes.ts`'s handlePutIntake comment). This migration moves the DB floor to match
-- so the backstop enforces the same number the validator does.
--
-- D1 migrations are apply-once and tracked by name, so this is a NEW migration file, not an edit
-- to `0002_app_schema.sql` (same rule `0001_better_auth.sql` states for better-auth's tables).
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt: create the new shape,
-- copy the rows that still satisfy the stricter floor, drop the old table, rename the new one.
-- Rows holding age < 13 cannot exist through the app (the validator refuses them), and if any
-- slipped in via a pre-13 write, they are dropped here rather than grandfathered: a floor is a
-- floor.

PRAGMA foreign_keys = OFF;

CREATE TABLE intake_responses_new (
  user_id              TEXT PRIMARY KEY NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  goal                 TEXT    NOT NULL,
  age                  INTEGER NOT NULL CHECK (age >= 13 AND age <= 100),
  experience           TEXT    NOT NULL CHECK (
                         experience IN ('new', 'some', 'regular', 'experienced', 'competitive')
                       ),
  days_per_week        INTEGER NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  weekly_km            REAL    NOT NULL CHECK (weekly_km >= 0),

  race_distance        TEXT    CHECK (race_distance IN ('5k', '10k', 'half', 'marathon')),
  race_date            TEXT,
  goal_time_sec        INTEGER CHECK (goal_time_sec IS NULL OR goal_time_sec > 0),
  recent_perf_distance TEXT    CHECK (recent_perf_distance IN ('5k', '10k', 'half', 'marathon')),
  recent_perf_time_sec INTEGER CHECK (recent_perf_time_sec IS NULL OR recent_perf_time_sec > 0),

  injuries             TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(injuries)),
  injury_notes         TEXT,
  updated_at           TEXT    NOT NULL,

  CHECK (
    (recent_perf_distance IS NULL AND recent_perf_time_sec IS NULL)
    OR (recent_perf_distance IS NOT NULL AND recent_perf_time_sec IS NOT NULL)
  )
);

INSERT INTO intake_responses_new
  SELECT * FROM intake_responses WHERE age >= 13;

DROP TABLE intake_responses;
ALTER TABLE intake_responses_new RENAME TO intake_responses;

PRAGMA foreign_keys = ON;
