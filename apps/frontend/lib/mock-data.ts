export interface Question {
  id: number;
  type: "mcq" | "numeric";
  status: "unvisited" | "saved" | "skipped" | "review";
  imageUrl: string | null;
  text: string;
  options: string[] | null;
  topic: string;
  correctAnswer: string | null;
  timeSpent: number;
  isCorrect: boolean | null;
  hint: string | null;
}

export interface PracticeTest {
  id: number;
  label: string;
  icon: string;
  qs: number;
  avg: number;
  color: "cyan" | "mint" | "forest";
}

export interface ChapterAccuracy {
  name: string;
  acc: number;
}

export interface Student {
  id: string;
  name: string;
  batch: string;
  tests: number;
  avg: number;
  status: "active" | "at-risk" | "inactive";
}

export interface ProctorSession {
  id: string;
  student: string;
  section: string;
  progress: number;
  tabs: number;
  focus: number;
  status: "clean" | "flagged";
}

export interface ScoreData {
  correct: number;
  incorrect: number;
  skipped: number;
  percent: number;
  total: number;
}

export const PRACTICE_TESTS: PracticeTest[] = [
  { id: 1, label: "Kinematics", icon: "K", qs: 45, avg: 78, color: "cyan" },
  { id: 2, label: "Thermodynamics", icon: "T", qs: 30, avg: 64, color: "mint" },
  { id: 3, label: "Electrostatics", icon: "E", qs: 60, avg: 82, color: "forest" },
  { id: 4, label: "Optics", icon: "O", qs: 35, avg: 71, color: "cyan" },
  { id: 5, label: "Modern Physics", icon: "M", qs: 50, avg: 69, color: "mint" },
  { id: 6, label: "Organic Chemistry", icon: "C", qs: 55, avg: 66, color: "cyan" },
];

export const ANALYTICS_WEEKS = [
  { label: "W1", v: 62 },
  { label: "W2", v: 67 },
  { label: "W3", v: 64 },
  { label: "W4", v: 72 },
  { label: "W5", v: 78 },
  { label: "W6", v: 75 },
  { label: "W7", v: 81 },
  { label: "W8", v: 85 },
];

const TOPICS = [
  "Mechanics", "Thermodynamics", "Electrostatics", "Optics", "Modern Physics",
  "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry",
  "Algebra", "Calculus", "Coordinate Geometry", "Vectors"
];

export function generateQuestions(count: number = 75): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: i % 5 === 0 ? "numeric" : "mcq",
    status: "unvisited" as const,
    imageUrl: (i === 11 || i === 42)
      ? `https://placehold.co/600x200/121824/48BEFF?text=${encodeURIComponent(
          i === 11 ? "Physics+Diagram:+Projectile+Trajectory" : "Chemistry+Diagram:+Reaction+Mechanism"
        )}`
      : null,
    text: i % 5 === 0
      ? `The position of a particle is given by x = ${2 + (i % 7)}t² + ${3 + (i % 5)}t. Find the velocity at t = ${1 + (i % 3)}s.`
      : `Q${i + 1}: A projectile is launched at an angle of ${30 + i * 2}° with initial velocity ${20 + (i % 10)} m/s. The maximum height attained is approximately:`,
    options: i % 5 !== 0
      ? [
          `${(5 + (i % 20)).toFixed(1)} m`,
          `${(12 + (i % 18)).toFixed(1)} m`,
          `${(24 + (i % 15)).toFixed(1)} m`,
          `${(36 + (i % 12)).toFixed(1)} m`,
        ]
      : null,
    topic: TOPICS[i % 12],
    correctAnswer: i % 5 === 0 ? null : String.fromCharCode(65 + (i % 4)),
    timeSpent: Math.floor(Math.random() * 180) + 10,
    isCorrect: i % 7 === 0 ? null : i % 3 === 0,
    hint: i % 3 === 0 ? "Apply the formula carefully — check unit conversions before substituting values." : null,
  }));
}

export const TEACHER_STUDENTS: Student[] = [
  { id: "STU-2841", name: "Aarav Mehta", batch: "A1", tests: 24, avg: 82, status: "active" },
  { id: "STU-2842", name: "Priya Nair", batch: "A1", tests: 18, avg: 76, status: "active" },
  { id: "STU-2843", name: "Vikram Rao", batch: "A2", tests: 30, avg: 88, status: "active" },
  { id: "STU-2844", name: "Sanya Gupta", batch: "A2", tests: 12, avg: 64, status: "at-risk" },
  { id: "STU-2845", name: "Arjun Iyer", batch: "A3", tests: 22, avg: 91, status: "active" },
  { id: "STU-2846", name: "Diya Patel", batch: "A3", tests: 8, avg: 58, status: "inactive" },
  { id: "STU-2847", name: "Kabir Singh", batch: "A1", tests: 28, avg: 79, status: "active" },
  { id: "STU-2848", name: "Ananya Reddy", batch: "A2", tests: 16, avg: 84, status: "active" },
];

export const PROCTOR_SESSIONS: ProctorSession[] = [
  { id: "SES-001", student: "Aarav Mehta", section: "Physics", progress: 64, tabs: 1, focus: 3, status: "clean" },
  { id: "SES-002", student: "Priya Nair", section: "Chemistry", progress: 72, tabs: 0, focus: 1, status: "clean" },
  { id: "SES-003", student: "Vikram Rao", section: "Mathematics", progress: 48, tabs: 3, focus: 5, status: "flagged" },
  { id: "SES-004", student: "Sanya Gupta", section: "Physics", progress: 32, tabs: 2, focus: 2, status: "clean" },
  { id: "SES-005", student: "Arjun Iyer", section: "Mathematics", progress: 89, tabs: 0, focus: 0, status: "clean" },
  { id: "SES-006", student: "Diya Patel", section: "Chemistry", progress: 55, tabs: 4, focus: 6, status: "flagged" },
];

export function generateScore(): ScoreData {
  const correct = Math.floor(Math.random() * 20) + 40;
  const incorrect = Math.floor(Math.random() * 20) + 5;
  const skipped = 75 - correct - incorrect;
  return {
    correct,
    incorrect,
    skipped,
    percent: Math.round((correct / 75) * 100),
    total: 75,
  };
}