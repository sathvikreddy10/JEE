"use client";

interface KeypadProps {
  onInput: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function Keypad({ onInput, onClear, onSubmit }: KeypadProps) {
  const keys = [
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: "÷", value: "÷", color: "var(--amber)" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "×", value: "×", color: "var(--amber)" },
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "−", value: "−", color: "var(--amber)" },
    { label: "0", value: "0" },
    { label: ".", value: "." },
    { label: "CLR", value: "CLR", color: "var(--crimson)" },
    { label: "↵", value: "SUBMIT", color: "var(--cyan)", bg: true },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {keys.map((key) => (
        <button
          key={key.label}
          onClick={() => {
            if (key.value === "CLR") onClear();
            else if (key.value === "SUBMIT") onSubmit();
            else onInput(key.value);
          }}
          className="py-4 rounded text-center font-mono text-base transition-all hover:border-[var(--cyan)]"
          style={{
            background: key.bg ? "var(--cyan)" : "var(--bg-input)",
            color: key.color || (key.bg ? "var(--text-inverse)" : "var(--text-primary)"),
            border: "1px solid var(--border-subtle)",
          }}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}