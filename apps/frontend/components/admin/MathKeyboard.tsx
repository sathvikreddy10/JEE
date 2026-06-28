"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface MathKey {
  label: string;
  insert: string;
  offset?: number;
  title?: string;
}

export interface MathKeyCategory {
  name: string;
  keys: MathKey[];
}

const CATEGORIES: MathKeyCategory[] = [
  {
    name: "Basic",
    keys: [
      { label: "+", insert: "+" },
      { label: "−", insert: "-" },
      { label: "×", insert: "\\times " },
      { label: "÷", insert: "\\div " },
      { label: "±", insert: "\\pm " },
      { label: "=", insert: "=" },
      { label: "≠", insert: "\\neq " },
      { label: "≈", insert: "\\approx " },
      { label: "<", insert: "<" },
      { label: ">", insert: ">" },
      { label: "≤", insert: "\\leq " },
      { label: "≥", insert: "\\geq " },
      { label: "(", insert: "(" },
      { label: ")", insert: ")" },
      { label: "[", insert: "[" },
      { label: "]", insert: "]" },
      { label: "{", insert: "{" },
      { label: "}", insert: "}" },
      { label: ",", insert: "," },
      { label: "|x|", insert: "\\left|  \\right|", offset: -9, title: "Absolute value" },
      { label: "⌊x⌋", insert: "\\lfloor  \\rfloor", offset: -9, title: "Floor" },
      { label: "⌈x⌉", insert: "\\lceil  \\rceil", offset: -8, title: "Ceiling" },
      { label: "∞", insert: "\\infty " },
      { label: "π", insert: "\\pi " },
      { label: "e", insert: "e" },
      { label: "i", insert: "i", title: "Imaginary unit" },
      { label: "Ans", insert: "\\text{Ans}" },
      { label: "M+", insert: "\\text{M+}" },
      { label: "M−", insert: "\\text{M−}" },
    ],
  },
  {
    name: "Powers",
    keys: [
      { label: "x²", insert: "^2" },
      { label: "x³", insert: "^3" },
      { label: "xʸ", insert: "^{}", offset: -1, title: "Custom exponent" },
      { label: "√", insert: "\\sqrt{}", offset: -1, title: "Square root" },
      { label: "∛", insert: "\\sqrt[3]{}", offset: -1, title: "Cube root" },
      { label: "ⁿ√", insert: "\\sqrt[]{}", offset: -3, title: "Nth root" },
      { label: "¹/x", insert: "^{-1}" },
      { label: "10ˣ", insert: "10^{}" },
      { label: "eˣ", insert: "e^{}" },
      { label: "x⁻¹", insert: "^{-1}" },
      { label: "xᵀ", insert: "^T", title: "Transpose" },
      { label: "^{-1}", insert: "^{-1}", title: "Inverse" },
    ],
  },
  {
    name: "Logs",
    keys: [
      { label: "log", insert: "\\log " },
      { label: "ln", insert: "\\ln " },
      { label: "logₐ", insert: "\\log_{}", offset: -1, title: "Log arbitrary base" },
      { label: "10ˣ", insert: "10^{}" },
      { label: "eˣ", insert: "e^{}" },
      { label: "exp", insert: "\\exp " },
    ],
  },
  {
    name: "Trig",
    keys: [
      { label: "sin", insert: "\\sin " },
      { label: "cos", insert: "\\cos " },
      { label: "tan", insert: "\\tan " },
      { label: "sin⁻¹", insert: "\\arcsin " },
      { label: "cos⁻¹", insert: "\\arccos " },
      { label: "tan⁻¹", insert: "\\arctan " },
      { label: "sinh", insert: "\\sinh " },
      { label: "cosh", insert: "\\cosh " },
      { label: "tanh", insert: "\\tanh " },
      { label: "sinh⁻¹", insert: "\\sinh^{-1} " },
      { label: "cosh⁻¹", insert: "\\cosh^{-1} " },
      { label: "tanh⁻¹", insert: "\\tanh^{-1} " },
      { label: "cot", insert: "\\cot " },
      { label: "sec", insert: "\\sec " },
      { label: "csc", insert: "\\csc " },
      { label: "°", insert: "^\\circ " },
    ],
  },
  {
    name: "Calculus",
    keys: [
      { label: "∫", insert: "\\int_{}^{}", title: "Definite integral" },
      { label: "∂/∂x", insert: "\\frac{\\partial}{\\partial x}" },
      { label: "d/dx", insert: "\\frac{d}{dx}" },
      { label: "∑", insert: "\\sum_{}^{}", title: "Summation" },
      { label: "∏", insert: "\\prod_{}^{}", title: "Product" },
      { label: "lim", insert: "\\lim_{}", offset: -1, title: "Limit" },
      { label: "∞", insert: "\\infty " },
      { label: "→", insert: "\\to " },
    ],
  },
  {
    name: "Greek",
    keys: [
      { label: "α", insert: "\\alpha " },
      { label: "β", insert: "\\beta " },
      { label: "γ", insert: "\\gamma " },
      { label: "δ", insert: "\\delta " },
      { label: "ε", insert: "\\epsilon " },
      { label: "θ", insert: "\\theta " },
      { label: "λ", insert: "\\lambda " },
      { label: "μ", insert: "\\mu " },
      { label: "π", insert: "\\pi " },
      { label: "ρ", insert: "\\rho " },
      { label: "σ", insert: "\\sigma " },
      { label: "φ", insert: "\\phi " },
      { label: "ω", insert: "\\omega " },
      { label: "Γ", insert: "\\Gamma " },
      { label: "Δ", insert: "\\Delta " },
      { label: "Θ", insert: "\\Theta " },
      { label: "Λ", insert: "\\Lambda " },
      { label: "Π", insert: "\\Pi " },
      { label: "Σ", insert: "\\Sigma " },
      { label: "Ω", insert: "\\Omega " },
    ],
  },
  {
    name: "Complex",
    keys: [
      { label: "i", insert: "i", title: "Imaginary unit" },
      { label: "∠", insert: "\\angle " },
      { label: "z̄", insert: "\\overline{}", offset: -1, title: "Conjugate" },
      { label: "ℜ", insert: "\\Re " },
      { label: "ℑ", insert: "\\Im " },
      { label: "r∠θ", insert: "r\\angle \\theta" },
      { label: "|z|", insert: "\\left| z \\right|" },
      { label: "e^(iθ)", insert: "e^{i\\theta}" },
    ],
  },
  {
    name: "Base-N",
    keys: [
      { label: "&", insert: "\\&" },
      { label: "|", insert: "\\vert " },
      { label: "⊕", insert: "\\oplus " },
      { label: "⊙", insert: "\\odot " },
      { label: "¬", insert: "\\neg " },
      { label: "~", insert: "\\sim " },
      { label: "0x", insert: "0x" },
      { label: "0b", insert: "0b" },
      { label: "0o", insert: "0o" },
      { label: "<<", insert: "\\ll " },
      { label: ">>", insert: "\\gg " },
    ],
  },
  {
    name: "Matrix",
    keys: [
      { label: "det", insert: "\\det " },
      { label: "tr", insert: "\\text{tr} " },
      { label: "T", insert: "^T" },
      { label: "I", insert: "I" },
      { label: "pmatrix", insert: "\\begin{pmatrix}\n\n\\end{pmatrix}", offset: -16 },
      { label: "bmatrix", insert: "\\begin{bmatrix}\n\n\\end{bmatrix}", offset: -16 },
      { label: "vmatrix", insert: "\\begin{vmatrix}\n\n\\end{vmatrix}", offset: -16 },
      { label: "2×2", insert: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { label: "3×3", insert: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}" },
    ],
  },
  {
    name: "Vector",
    keys: [
      { label: "û", insert: "\\hat{}", offset: -1, title: "Unit vector" },
      { label: "·", insert: "\\cdot " },
      { label: "×", insert: "\\times " },
      { label: "∠", insert: "\\angle " },
      { label: "|v|", insert: "\\left| \\vec{v} \\right|" },
      { label: "\\vec{}", insert: "\\vec{}", offset: -1 },
    ],
  },
  {
    name: "Stats",
    keys: [
      { label: "x̄", insert: "\\bar{x}" },
      { label: "σ", insert: "\\sigma " },
      { label: "s", insert: "s" },
      { label: "∑x", insert: "\\sum x" },
      { label: "∑x²", insert: "\\sum x^2" },
      { label: "μ", insert: "\\mu " },
      { label: "nPr", insert: "{}_{}P{}" },
      { label: "nCr", insert: "{}_{}C{}" },
      { label: "C(n,k)", insert: "\\binom{}{}", offset: -3 },
      { label: "n!", insert: "!" },
    ],
  },
  {
    name: "Logic",
    keys: [
      { label: "∈", insert: "\\in " },
      { label: "∉", insert: "\\notin " },
      { label: "⊆", insert: "\\subseteq " },
      { label: "⊂", insert: "\\subset " },
      { label: "∪", insert: "\\cup " },
      { label: "∩", insert: "\\cap " },
      { label: "∅", insert: "\\emptyset " },
      { label: "∀", insert: "\\forall " },
      { label: "∃", insert: "\\exists " },
      { label: "¬", insert: "\\neg " },
      { label: "∧", insert: "\\land " },
      { label: "∨", insert: "\\lor " },
      { label: "⇒", insert: "\\Rightarrow " },
      { label: "⇔", insert: "\\Leftrightarrow " },
    ],
  },
  {
    name: "Arrows",
    keys: [
      { label: "→", insert: "\\rightarrow " },
      { label: "←", insert: "\\leftarrow " },
      { label: "↑", insert: "\\uparrow " },
      { label: "↓", insert: "\\downarrow " },
      { label: "↔", insert: "\\leftrightarrow " },
      { label: "⇒", insert: "\\Rightarrow " },
      { label: "⇐", insert: "\\Leftarrow " },
      { label: "⇔", insert: "\\Leftrightarrow " },
      { label: "↦", insert: "\\mapsto " },
      { label: "\\xrightarrow{}", insert: "\\xrightarrow{}", offset: -1 },
    ],
  },
  {
    name: "Sub/Sup",
    keys: [
      { label: "⁰", insert: "^0" },
      { label: "¹", insert: "^1" },
      { label: "²", insert: "^2" },
      { label: "³", insert: "^3" },
      { label: "⁴", insert: "^4" },
      { label: "⁵", insert: "^5" },
      { label: "⁶", insert: "^6" },
      { label: "⁷", insert: "^7" },
      { label: "⁸", insert: "^8" },
      { label: "⁹", insert: "^9" },
      { label: "₀", insert: "_0" },
      { label: "₁", insert: "_1" },
      { label: "₂", insert: "_2" },
      { label: "₃", insert: "_3" },
      { label: "₄", insert: "_4" },
      { label: "₅", insert: "_5" },
      { label: "₆", insert: "_6" },
      { label: "₇", insert: "_7" },
      { label: "₈", insert: "_8" },
      { label: "₉", insert: "_9" },
    ],
  },
];

interface MathKeyboardProps {
  onInsert: (insert: string, cursorOffset?: number) => void;
  className?: string;
}

export function MathKeyboard({ onInsert, className }: MathKeyboardProps) {
  const [active, setActive] = useState<string>(CATEGORIES[0].name);

  const activeCategory = CATEGORIES.find((c) => c.name === active) ?? CATEGORIES[0];

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-3", className)}>
      <div className="flex flex-wrap gap-1 mb-3 border-b border-border pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActive(cat.name)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-colors",
              active === cat.name
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
        {activeCategory.keys.map((k, i) => (
          <button
            key={`${active}-${i}`}
            type="button"
            onClick={() => onInsert(k.insert, k.offset)}
            className="px-2 py-1.5 rounded-md bg-background border border-border text-foreground text-xs font-mono hover:bg-muted transition-colors"
            title={k.title ?? k.insert}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
