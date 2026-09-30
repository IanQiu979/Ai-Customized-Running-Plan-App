-- Account-level age assurance and atomic guardian consent (2026-10-01).
--
-- Existing accounts are grandfathered during this migration. New accounts default to pending as
-- an explicit unresolved state. The currently deployed Worker does not enforce the pending gate,
-- so production traffic must be held between applying this migration and deploying and verifying
-- the matching Worker. Email signup and OAuth first-use later move a pending row to the one
-- write-once recorded tuple.
--
-- The consent triggers deliberately use plain INSERT. A duplicate or otherwise failed consent
-- write is an invariant failure and aborts the outer user INSERT/UPDATE, keeping the assurance row
-- and its evidence atomic in SQLite.

ALTER TABLE user ADD COLUMN age_band TEXT;
ALTER TABLE user ADD COLUMN age_assurance_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user ADD COLUMN age_policy_version TEXT;

UPDATE user SET age_assurance_status = 'grandfathered';

CREATE TRIGGER age_assurance_tuple_valid_insert
BEFORE INSERT ON user
FOR EACH ROW
WHEN CASE
  WHEN NEW.age_assurance_status = 'pending'
    AND NEW.age_band IS NULL
    AND NEW.age_policy_version IS NULL THEN 0
  WHEN NEW.age_assurance_status = 'recorded'
    AND NEW.age_band IN ('18_plus', '13_17')
    AND length(trim(NEW.age_policy_version)) > 0 THEN 0
  ELSE 1
END = 1
BEGIN
  SELECT RAISE(ABORT, 'invalid age assurance tuple');
END;

CREATE TRIGGER age_assurance_tuple_valid_update
BEFORE UPDATE ON user
FOR EACH ROW
WHEN CASE
  WHEN NEW.age_assurance_status = 'pending'
    AND NEW.age_band IS NULL
    AND NEW.age_policy_version IS NULL THEN 0
  WHEN NEW.age_assurance_status = 'grandfathered'
    AND NEW.age_band IS NULL
    AND NEW.age_policy_version IS NULL THEN 0
  WHEN NEW.age_assurance_status = 'recorded'
    AND NEW.age_band IN ('18_plus', '13_17')
    AND length(trim(NEW.age_policy_version)) > 0 THEN 0
  ELSE 1
END = 1
BEGIN
  SELECT RAISE(ABORT, 'invalid age assurance tuple');
END;

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
BEGIN
  SELECT RAISE(ABORT, 'age assurance is write-once');
END;

CREATE TRIGGER age_assurance_minor_consent_insert
AFTER INSERT ON user
FOR EACH ROW
WHEN NEW.age_assurance_status = 'recorded' AND NEW.age_band = '13_17'
BEGIN
  INSERT INTO guardian_consent (user_id, granted_at, policy_version)
  VALUES (
    NEW.id,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    NEW.age_policy_version
  );
END;

CREATE TRIGGER age_assurance_minor_consent_update
AFTER UPDATE ON user
FOR EACH ROW
WHEN OLD.age_assurance_status = 'pending'
  AND NEW.age_assurance_status = 'recorded'
  AND NEW.age_band = '13_17'
BEGIN
  INSERT INTO guardian_consent (user_id, granted_at, policy_version)
  VALUES (
    NEW.id,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    NEW.age_policy_version
  );
END;
