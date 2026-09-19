-- Guardian consent for 13–17 runners (2026-09-19).
--
-- Captain's ruling, 2026-09-19: V2.2's under-18 posture is "13–17 may use the app WITH a
-- parent/guardian's consent." The legal basis is explicit consent — GDPR Art. 9(2)(a) (processing
-- of health data with the data subject's, or here the guardian's, explicit consent) and Thai
-- PDPA s.26 (sensitive personal data requires explicit consent). "Explicit consent" is a specific
-- legal claim, not a UI nicety, so it must be provable after the fact: a checkbox the client
-- asserted is not evidence of anything unless the server independently records that the event
-- happened, when, and against which version of the policy the guardian agreed to.
--
-- One row per user, upserted (INSERT OR REPLACE) on every 13–17 intake save — this is the most
-- recent consent event, not a history of every time a minor saved their intake. That matches the
-- age-13 floor's own reasoning in `0003_raise_intake_age_floor.sql`: this project keeps exactly the
-- state it needs to enforce a rule, not a full audit log, unless a future ruling asks for one.
--
-- `policy_version` is `src/constants/legal.ts`'s `PRIVACY_POLICY_VERSION`, so a consent row always
-- says which revision of `docs/privacy-policy.md` the guardian actually saw, independent of
-- whatever the policy says today.
--
-- D1 migrations are apply-once and tracked by name, so this is a new file, not an edit to
-- `0002_app_schema.sql` (same rule `0003` already states).

CREATE TABLE guardian_consent (
  user_id        TEXT NOT NULL PRIMARY KEY REFERENCES user (id) ON DELETE CASCADE,
  granted_at     TEXT NOT NULL,
  policy_version TEXT NOT NULL
);
