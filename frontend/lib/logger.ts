// Client-side logger — shows in browser console

function ts(): string {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

const styles = {
  cyan: "color: #0EA5E9; font-weight: 600",
  green: "color: #22C55E; font-weight: 600",
  yellow: "color: #D97706; font-weight: 600",
  red: "color: #DC2626; font-weight: 600",
  blue: "color: #2563EB; font-weight: 600",
  gray: "color: #64748B",
};

export const log = {
  api: (method: string, path: string, body?: unknown) => {
    console.log(
      `%c[${ts()}] %c${method} %c${path}`,
      styles.gray,
      styles.cyan,
      styles.blue,
      body !== undefined ? body : ""
    );
  },
  res: (method: string, path: string, status: number, body?: unknown) => {
    const color = status >= 200 && status < 300 ? styles.green : styles.red;
    console.log(
      `%c[${ts()}] %c${method} %c${path} %c${status}`,
      styles.gray,
      styles.cyan,
      styles.blue,
      color,
      body !== undefined ? body : ""
    );
  },
  err: (where: string, err: unknown) => {
    console.error(`%c[${ts()}] %cERR %c${where}`, styles.gray, styles.red, styles.yellow, err);
  },
  info: (msg: string, extra?: unknown) => {
    console.log(`%c[${ts()}] %cINFO %c${msg}`, styles.gray, styles.cyan, "", extra ?? "");
  },
  success: (msg: string, extra?: unknown) => {
    console.log(`%c[${ts()}] %c✓ %c${msg}`, styles.gray, styles.green, "", extra ?? "");
  },
  warn: (msg: string, extra?: unknown) => {
    console.warn(`%c[${ts()}] %cWARN %c${msg}`, styles.gray, styles.yellow, "", extra ?? "");
  },
  queue: (q: number) => {
    console.log(`%c[${ts()}] %cQUEUE %c${q} pending saves`, styles.gray, styles.yellow, "");
  },
};
