/*
  Warnings:

  - You are about to drop the `DailyChallengeQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DailyChallengeToQuestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ExamSession" ADD COLUMN "markingScheme" TEXT;

-- AlterTable
ALTER TABLE "QuestionSet" ADD COLUMN "markingScheme" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DailyChallengeQuestion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_DailyChallengeToQuestion";
PRAGMA foreign_keys=on;
