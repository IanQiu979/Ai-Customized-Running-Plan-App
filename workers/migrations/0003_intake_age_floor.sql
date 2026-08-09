-- Align the database backstop with the captain-approved age floor already enforced by the Worker.
-- SQLite cannot alter a CHECK constraint in place, so reject legacy-under-floor writes with
-- triggers. Existing local/test databases are empty; production is not deployed yet.

CREATE TRIGGER IF NOT EXISTS intake_age_floor_insert
BEFORE INSERT ON intake_responses
WHEN NEW.age < 13
BEGIN
  SELECT RAISE(ABORT, 'age must be at least 13');
END;

CREATE TRIGGER IF NOT EXISTS intake_age_floor_update
BEFORE UPDATE OF age ON intake_responses
WHEN NEW.age < 13
BEGIN
  SELECT RAISE(ABORT, 'age must be at least 13');
END;
