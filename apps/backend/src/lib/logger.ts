// Tiny console logger with timestamps
// Server side: prints to stdout
// Client side: prints to browser console

function ts(): string {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

function colorize(text: string, color: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).window !== "undefined") return text; // Browser: no color codes
  const codes: Record<string, string> = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    reset: "\x1b[0m",
  };
  return `${codes[color] || ""}${text}${codes.reset}`;
}

export const log = {
  api: (method: string, path: string, extra?: unknown) => {
    console.log(
      `${colorize(`[${ts()}]`, "gray")} ${colorize(method, "cyan")} ${colorize(path, "blue")}`,
      extra !== undefined ? colorize(JSON.stringify(extra), "gray") : ""
    );
  },
  db: (action: string, table: string, data?: unknown) => {
    console.log(
      `${colorize(`[${ts()}]`, "gray")} ${colorize("DB", "green")} ${colorize(action, "yellow")} ${colorize(table, "blue")}`,
      data !== undefined ? colorize(JSON.stringify(data), "gray") : ""
    );
  },
  err: (where: string, err: unknown) => {
    console.error(
      `${colorize(`[${ts()}]`, "gray")} ${colorize("ERR", "red")} ${colorize(where, "yellow")}`,
      err instanceof Error ? err.message : err
    );
  },
  info: (msg: string, extra?: unknown) => {
    console.log(
      `${colorize(`[${ts()}]`, "gray")} ${colorize("INFO", "cyan")} ${msg}`,
      extra !== undefined ? colorize(JSON.stringify(extra), "gray") : ""
    );
  },
  success: (msg: string, extra?: unknown) => {
    console.log(
      `${colorize(`[${ts()}]`, "gray")} ${colorize("✓", "green")} ${msg}`,
      extra !== undefined ? colorize(JSON.stringify(extra), "gray") : ""
    );
  },
  warn: (msg: string, extra?: unknown) => {
    console.warn(
      `${colorize(`[${ts()}]`, "gray")} ${colorize("WARN", "yellow")} ${msg}`,
      extra !== undefined ? colorize(JSON.stringify(extra), "gray") : ""
    );
  },
};
