-- The one-way aging transition: a recorded 13–17 account becomes 18+ once (2026-10-01).
--
-- Captain's decision, 2026-10-01: a runner on a `13_17` account self-declares a date of birth at
-- least 18 years old and the account moves to `18_plus`. It is irreversible — there is no path
-- back. The guardian consent row is ARCHIVED, not deleted: it is the evidence that consent existed
-- while it was required, which is exactly what a later question about how a minor's data was
-- handled would ask for. No guardian is notified.
--
-- ARCHIVE SHAPE. Two nullable columns on `guardian_consent` rather than a separate history table:
-- one row per user already (`0004`), so an auditor reads one row and sees the whole story —
-- `granted_at` / `policy_version` (when, and under which policy, the consent was recorded) and
-- `archived_at` / `archived_reason` (when, and why, it stopped being in force). `archived_at IS
-- NULL` means in force. `archived_reason` is a closed set of one value, `aged_out_self_declared`,
-- which says in the row itself that the birthday behind it was the runner's own declaration, not a
-- verified fact. The declared birthday itself is NOT stored: the transition needs only "at least
-- 18", and keeping a minor's exact date of birth would be new personal data the policy does not
-- otherwise need.
--
-- ATOMICITY. The transition is one `UPDATE user` statement; the archive is an AFTER UPDATE trigger
-- in that same statement, and it aborts the statement if no in-force consent row was archived. So
-- a transitioned account always has its archived consent row, and a failed archive leaves the
-- account a minor — the same "one SQLite statement" guarantee `0005` gives the consent insert.
--
-- `age_policy_version` is restamped by the Worker to the policy version the adult declaration was
-- made under. The policy the guardian agreed to is not lost: it is `guardian_consent.policy_version`.

ALTER TABLE guardian_consent ADD COLUMN archived_at TEXT;
ALTER TABLE guardian_consent ADD COLUMN archived_reason TEXT;

-- Consent is always recorded in force, and an archived row is never replaced. The second half
-- matters because `INSERT OR REPLACE` deletes the conflicting row before inserting; a BEFORE INSERT
-- trigger runs ahead of that conflict resolution, so it can refuse to let any insert wipe an
-- archive. (Only grandfathered accounts use that upsert today, and they never transition.)
CREATE TRIGGER guardian_consent_insert_in_force
BEFORE INSERT ON guardian_consent
FOR EACH ROW
WHEN NEW.archived_at IS NOT NULL
  OR NEW.archived_reason IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM guardian_consent
     WHERE user_id = NEW.user_id AND archived_at IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'guardian consent must be inserted in force and never over an archive');
END;

-- An archived row is immutable. Archiving an in-force row sets both archive columns together, to
-- a known reason, and changes nothing else about the consent it records.
CREATE TRIGGER guardian_consent_archive_valid
BEFORE UPDATE ON guardian_consent
FOR EACH ROW
WHEN OLD.archived_at IS NOT NULL
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.granted_at IS NOT OLD.granted_at
  OR NEW.policy_version IS NOT OLD.policy_version
  OR CASE
    WHEN NEW.archived_at IS NULL AND NEW.archived_reason IS NULL THEN 0
    WHEN length(trim(NEW.archived_at)) > 0
      AND NEW.archived_reason = 'aged_out_self_declared' THEN 0
    ELSE 1
  END = 1
BEGIN
  SELECT RAISE(ABORT, 'archived guardian consent is immutable');
END;

-- `0005`'s write-once rule, plus exactly one more allowed change: recorded `13_17` to recorded
-- `18_plus`. Nothing else moves — not `18_plus` back to `13_17`, not grandfathered to anything.
DROP TRIGGER age_assurance_is_write_once;

CREATE TRIGGER age_assurance_is_write_once
BEFORE UPDATE ON user
FOR EACH ROW
WHEN (
  NEW.age_band IS NOT OLD.age_band
  OR NEW.age_assurance_status IS NOT OLD.age_assurance_status
  OR NEW.age_policy_version IS NOT OLD.age_policy_version
)
AND NOT (
  OLD.age_assurance_status = 'pending'
  AND OLD.age_band IS NULL
  AND OLD.age_policy_version IS NULL
  AND NEW.age_assurance_status = 'recorded'
  AND NEW.age_band IN ('18_plus', '13_17')
  AND length(trim(NEW.age_policy_version)) > 0
)
AND NOT (
  OLD.age_assurance_status = 'recorded'
  AND OLD.age_band = '13_17'
  AND NEW.age_assurance_status = 'recorded'
  AND NEW.age_band = '18_plus'
  AND length(trim(NEW.age_policy_version)) > 0
)
BEGIN
  SELECT RAISE(ABORT, 'age assurance is write-once');
END;

-- The archive, in the same statement as the transition. The trailing SELECT aborts the whole
-- `UPDATE user` when the user ends up with no archived consent row (there was no consent row to
-- archive), so the account can never be adult without its archived evidence.
CREATE TRIGGER age_assurance_minor_aged_out
AFTER UPDATE ON user
FOR EACH ROW
WHEN OLD.age_assurance_status = 'recorded'
  AND OLD.age_band = '13_17'
  AND NEW.age_band = '18_plus'
BEGIN
  UPDATE guardian_consent
     SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
         archived_reason = 'aged_out_self_declared'
   WHERE user_id = NEW.id AND archived_at IS NULL;

  SELECT RAISE(ABORT, 'aging transition found no guardian consent to archive')
   WHERE NOT EXISTS (
     SELECT 1 FROM guardian_consent
      WHERE user_id = NEW.id AND archived_reason = 'aged_out_self_declared'
   );
END;
