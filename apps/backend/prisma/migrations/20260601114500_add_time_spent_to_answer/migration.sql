-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedOption" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StudentAnswer" ("id", "isCorrect", "questionId", "selectedOption", "sessionId") SELECT "id", "isCorrect", "questionId", "selectedOption", "sessionId" FROM "StudentAnswer";
DROP TABLE "StudentAnswer";
ALTER TABLE "new_StudentAnswer" RENAME TO "StudentAnswer";
CREATE UNIQUE INDEX "StudentAnswer_sessionId_questionId_key" ON "StudentAnswer"("sessionId", "questionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
