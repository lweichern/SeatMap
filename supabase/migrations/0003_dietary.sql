-- Dietary seat counts per party, captured at RSVP or entered by the planner.
-- Shape: { "veg": 2, "halal": 1, "no_beef": 0, "child": 1, "allergy": "peanut" }
alter table guests add column if not exists dietary jsonb;
