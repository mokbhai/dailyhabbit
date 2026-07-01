-- Add scheduled challenge ranges and preserve the old "endDate as stopped-at"
-- semantics before endDate becomes the planned inclusive end date.
ALTER TABLE "Group" ADD COLUMN "challengeStartDate" DATETIME;
ALTER TABLE "Group" ADD COLUMN "challengeEndDate" DATETIME;
ALTER TABLE "Group" ADD COLUMN "challengeTimezone" TEXT;

ALTER TABLE "Challenge" ADD COLUMN "stoppedAt" DATETIME;

UPDATE "Challenge"
SET "stoppedAt" = "endDate"
WHERE "isActive" = false
  AND "endDate" IS NOT NULL;

UPDATE "Challenge"
SET "endDate" = datetime(date("startDate"), '+' || ("lengthDays" - 1) || ' days')
WHERE "endDate" IS NULL
   OR "isActive" = false;

UPDATE "Challenge"
SET "lengthDays" = CAST(
  julianday(date("endDate")) - julianday(date("startDate")) + 1 AS INTEGER
)
WHERE "endDate" IS NOT NULL;

UPDATE "Group"
SET
  "challengeStartDate" = (
    SELECT "Challenge"."startDate"
    FROM "Challenge"
    JOIN "User" ON "User"."id" = "Challenge"."userId"
    WHERE "User"."groupId" = "Group"."id"
    ORDER BY
      CASE
        WHEN "Challenge"."userId" = (
          SELECT "AdminGroup"."adminUserId"
          FROM "Group" AS "AdminGroup"
          WHERE "AdminGroup"."id" = "User"."groupId"
          LIMIT 1
        ) THEN 0
        ELSE 1
      END,
      "Challenge"."isActive" DESC,
      "Challenge"."startDate" DESC
    LIMIT 1
  ),
  "challengeEndDate" = (
    SELECT "Challenge"."endDate"
    FROM "Challenge"
    JOIN "User" ON "User"."id" = "Challenge"."userId"
    WHERE "User"."groupId" = "Group"."id"
    ORDER BY
      CASE
        WHEN "Challenge"."userId" = (
          SELECT "AdminGroup"."adminUserId"
          FROM "Group" AS "AdminGroup"
          WHERE "AdminGroup"."id" = "User"."groupId"
          LIMIT 1
        ) THEN 0
        ELSE 1
      END,
      "Challenge"."isActive" DESC,
      "Challenge"."startDate" DESC
    LIMIT 1
  ),
  "challengeTimezone" = (
    SELECT "User"."timezone"
    FROM "User"
    WHERE "User"."id" = "Group"."adminUserId"
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1
  FROM "Challenge"
  JOIN "User" ON "User"."id" = "Challenge"."userId"
  WHERE "User"."groupId" = "Group"."id"
);
