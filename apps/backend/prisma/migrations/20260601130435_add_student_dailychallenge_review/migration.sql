-- CreateTable
CREATE TABLE "Student" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "questionIds" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyChallengeQuestion" (
    "dailyChallengeId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    PRIMARY KEY ("dailyChallengeId", "questionId")
);

-- CreateTable
CREATE TABLE "DailyChallengeAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyChallengeAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DailyChallengeToQuestion" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DailyChallengeToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "DailyChallenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DailyChallengeToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExamSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "studentName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'regular',
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "timeLimit" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "total" INTEGER,
    "analytics" TEXT,
    CONSTRAINT "ExamSession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExamSession" ("analytics", "completed", "endTime", "id", "score", "setId", "startTime", "studentName", "timeLimit", "total") SELECT "analytics", "completed", "endTime", "id", "score", "setId", "startTime", "studentName", "timeLimit", "total" FROM "ExamSession";
DROP TABLE "ExamSession";
ALTER TABLE "new_ExamSession" RENAME TO "ExamSession";
CREATE TABLE "new_Question" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "imageUrl" TEXT,
    "images" TEXT,
    "order" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    CONSTRAINT "Question_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("correctAnswer", "explanation", "id", "imageUrl", "images", "options", "order", "setId", "text", "topic", "type") SELECT "correctAnswer", "explanation", "id", "imageUrl", "images", "options", "order", "setId", "text", "topic", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_StudentAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedOption" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER,
    CONSTRAINT "StudentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StudentAnswer" ("id", "isCorrect", "questionId", "selectedOption", "sessionId", "timeSpent") SELECT "id", "isCorrect", "questionId", "selectedOption", "sessionId", "timeSpent" FROM "StudentAnswer";
DROP TABLE "StudentAnswer";
ALTER TABLE "new_StudentAnswer" RENAME TO "StudentAnswer";
CREATE UNIQUE INDEX "StudentAnswer_sessionId_questionId_key" ON "StudentAnswer"("sessionId", "questionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Student_name_key" ON "Student"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_date_key" ON "DailyChallenge"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeAttempt_sessionId_key" ON "DailyChallengeAttempt"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "_DailyChallengeToQuestion_AB_unique" ON "_DailyChallengeToQuestion"("A", "B");

-- CreateIndex
CREATE INDEX "_DailyChallengeToQuestion_B_index" ON "_DailyChallengeToQuestion"("B");
