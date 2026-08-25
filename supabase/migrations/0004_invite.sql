-- Invite Studio configuration: couple names split, RSVP deadline, letter copy,
-- theme accent, and photo set.
-- Shape: { bride_name, groom_name, rsvp_deadline, letter: string[], red_accent, photos: {hero,bride,groom,editorial,candid1,candid2} }
alter table events add column if not exists invite jsonb;
