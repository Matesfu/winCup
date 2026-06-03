ALTER TABLE rooms
  ADD CONSTRAINT rooms_stake_amount_required
  CHECK (stake_amount IS NOT NULL AND stake_amount > 0)
  NOT VALID;

COMMENT ON CONSTRAINT rooms_stake_amount_required ON rooms IS
  'New rooms must include a positive stake amount before they can be created.';

COMMENT ON COLUMN rooms.stake_amount IS
  'Required positive stake amount shown on room cards, lobbies, and result screens.';
