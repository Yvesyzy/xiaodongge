-- CreateTable
CREATE TABLE "ReviewEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "albumName" TEXT,
    "songName" TEXT,
    "artistName" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "moods" TEXT,
    "rating" INTEGER,
    "listenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "YearlySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceEntryCount" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ReviewEntry_year_month_idx" ON "ReviewEntry"("year", "month");

-- CreateIndex
CREATE INDEX "ReviewEntry_albumName_idx" ON "ReviewEntry"("albumName");

-- CreateIndex
CREATE INDEX "ReviewEntry_songName_idx" ON "ReviewEntry"("songName");

-- CreateIndex
CREATE INDEX "ReviewEntry_artistName_idx" ON "ReviewEntry"("artistName");

-- CreateIndex
CREATE UNIQUE INDEX "YearlySummary_year_key" ON "YearlySummary"("year");
