-- Prisma's auto-generated diff for this change was DROP COLUMN + ADD COLUMN,
-- which would destroy every existing row's gender value — rejected and
-- hand-written instead. This preserves the plaintext enum value as a plain
-- TEXT string ("MALE"/"FEMALE"/"UNSPECIFIED") in the same column; a separate
-- backfill script (scripts/backfillPiiEncryption.mjs) then encrypts it in
-- place. Existing rows are NEVER dropped or reset.
ALTER TABLE "User" ALTER COLUMN "gender" TYPE TEXT USING "gender"::TEXT;
ALTER TABLE "User" ALTER COLUMN "gender" DROP DEFAULT;

-- DropEnum
DROP TYPE "Gender";
