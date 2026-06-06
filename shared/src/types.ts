// Shared types between frontend and backend
// Import via: import { ... } from "@testify/shared";

export type QuestionType = "mcq" | "mcq-multiple" | "numeric" | "fill-in-the-blanks";

export type QuestionSetKind = "INSTITUTE" | "PRACTICE";
export type QuestionSetExam = "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM";
export type TestSetStatus = "fresh" | "inProgress" | "attempted" | "exhausted" | "waiting";
export type BatchPaperLifecycle = "DRAFT" | "NOTIFIED" | "LIVE" | "CLOSED";
export type TestSetLifecycle = "waiting" | "live" | "closed";

/** A batch-assignment window on a QuestionSet that is currently available to the requesting user. */
export interface TestSetBatchPaper {
  id: number;
  batchId: number;
  batchName: string;
  scheduledStart: string;
  scheduledEnd: string;
  bufferMinutes: number;
  notifiedAt: string | null;
  goTime: string | null;
  /** ISO timestamp; null when goTime is null. */
  joinDeadline: string | null;
  effectiveStatus: "waiting" | "live" | "closed";
}

/** A QuestionSet as the student-facing catalog (GET /api/sets) sees it. */
export interface TestSet {
  id: number;
  name: string;
  subject: string;
  pattern: string;
  timeLimit: number;
  attemptsAllowed: number;
  questionCount: number;
  kind: QuestionSetKind;
  exam: QuestionSetExam;
  tags: string[];
  attemptsUsed: number;
  bestScore: number | null;
  lastScore: number | null;
  lastSessionId: number | null;
  inProgressSessionId: number | null;
  status: TestSetStatus;
  /** Available batch windows for the requesting user. */
  batchPapers: TestSetBatchPaper[];
  /** Top-level lifecycle across all the user's batch assignments. */
  effectiveLifecycle: TestSetLifecycle;
}

/** Admin's view of a BatchPaper assignment on a QuestionSet. */
export interface AdminBatchAssignment {
  id: number;
  batchId: number;
  batchName: string;
  scheduledStart: string;
  scheduledEnd: string;
  bufferMinutes: number;
  notifiedAt: string | null;
  goTime: string | null;
  joinDeadline: string | null;
  effectiveStatus: BatchPaperLifecycle;
  addedBy?: string;
  addedAt?: string;
}

/** Notification record. */
export interface AppNotification {
  id: number;
  userId: number;
  type: "PAPER_READY" | "PAPER_NOTIFIED" | "PAPER_LIVE" | "BUFFER_CLOSING" | "BUFFER_CLOSED" | "STUDENT_FLAGGED" | "STUDENT_AUTO_ENDED";
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** A batch the requesting student is a member of. */
export interface MyBatch {
  id: number;
  name: string;
  description: string | null;
  memberCount: number;
  paperCount: number;
}

export type Subject = "physics" | "chemistry" | "maths" | "mixed";

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  setId: number;
  type: QuestionType;
  text: string;
  options: QuestionOption[] | null;
  topic: string;
  order: number;
  imageUrl: string | null;
  images: string[] | null;
  correctAnswer?: string;
  explanation?: string;
  positiveMarks: number;
  negativeMarks: number;
}

export type SessionKind = "full" | "subject" | "daily-challenge";
export type MarkingMode = "default" | "partial" | "strict";

export interface ExamSession {
  id: number;
  setId: number;
  userId: number;
  studentName: string;
  kind: SessionKind;
  startTime: string;
  endTime: string | null;
  timeLimit: number;
  completed: boolean;
  score: number | null;
  total: number | null;
  tabSwitches: number;
  flaggedAt: string | null;
  flagReason: string | null;
  autoEndedAt: string | null;
}

export interface StudentAnswer {
  questionId: number;
  answer: string | string[] | null;
  correct: boolean | null;
  marks: number;
  timeSpent: number;
  flagged: boolean | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  studentName: string;
  score: number;
  total: number;
  percent: number;
  endTime: string | null;
  isYou: boolean;
}

export interface DailyChallengePayload {
  date: string;
  timeLimit: number;
  questionCount: number;
  isManual: boolean;
  createdBy: string;
  completed: boolean;
  attempt: {
    sessionId: number;
    score: number;
    total: number;
    percent: number;
    completedAt: string;
  } | null;
  setId: number | null;
  questions: Question[];
}

export interface StartExamResponse {
  sessionId: number;
  timeLimit: number;
  questions: Question[];
}

export interface AuthResponse {
  user: User;
  expiresAt: string;
}

export interface ApiError {
  error: string;
  sessionId?: number;
}
