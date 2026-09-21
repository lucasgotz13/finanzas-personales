-- Day-over-day change support (indicator-day-change): previous published
-- reading per indicator, kept next to the latest value on the same snapshot
-- row. Nullable — rows written before this migration and first-run snapshots
-- without a previous reading keep NULL and render no change badge.

ALTER TABLE indicator_snapshots ADD COLUMN prev_value REAL NULL;
