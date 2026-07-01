-- CreateTable
CREATE TABLE "GroupAdmin" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "userId"),
    CONSTRAINT "GroupAdmin_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GroupAdmin_userId_idx" ON "GroupAdmin"("userId");

-- Backfill existing single-admin groups as admin memberships.
INSERT INTO "GroupAdmin" ("groupId", "userId", "createdAt")
SELECT "id", "adminUserId", CURRENT_TIMESTAMP
FROM "Group";
