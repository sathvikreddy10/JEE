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
    name: "Common",
    keys: [
      { label: "$x$", insert: "$$", offset: -1, title: "Inline math" },
      { label: "$$x$$", insert: "$$\n\n$$", offset: -3, title: "Display math" },
      { label: "\\frac{}{}", insert: "\\frac{}{}", offset: -3, title: "Fraction" },
      { label: "\\sqrt{}", insert: "\\sqrt{}", offset: -1, title: "Square root" },
      { label: "\\sqrt[]{}", insert: "\\sqrt[]{},", offset: -3, title: "Nth root" },
      { label: "x^{}", insert: "^{}", offset: -1, title: "Superscript" },
      { label: "x_{}", insert: "_{}", offset: -1, title: "Subscript" },
      { label: "x^{}_{}", insert: "^{}_{}", offset: -3, title: "Superscript and subscript" },
      { label: "\\binom{}{}", insert: "\\binom{}{}", offset: -3, title: "Binomial coefficient" },
      { label: "\\overline{}", insert: "\\overline{}", offset: -1, title: "Overline" },
      { label: "\\underline{}", insert: "\\underline{}", offset: -1, title: "Underline" },
      { label: "\\vec{}", insert: "\\vec{}", offset: -1, title: "Vector" },
      { label: "\\hat{}", insert: "\\hat{}", offset: -1, title: "Hat" },
      { label: "\\widehat{}", insert: "\\widehat{}", offset: -1, title: "Wide hat" },
      { label: "\\overbrace{}{}", insert: "\\overbrace{}{}", offset: -4, title: "Overbrace" },
      { label: "\\underbrace{}{}", insert: "\\underbrace{}{}", offset: -4, title: "Underbrace" },
      { label: "\\text{}", insert: "\\text{}", offset: -1, title: "Text inside math" },
    ],
  },
  {
    name: "Greek",
    keys: [
      { label: "\\alpha", insert: "\\alpha " },
      { label: "\\beta", insert: "\\beta " },
      { label: "\\gamma", insert: "\\gamma " },
      { label: "\\delta", insert: "\\delta " },
      { label: "\\epsilon", insert: "\\epsilon " },
      { label: "\\zeta", insert: "\\zeta " },
      { label: "\\eta", insert: "\\eta " },
      { label: "\\theta", insert: "\\theta " },
      { label: "\\iota", insert: "\\iota " },
      { label: "\\kappa", insert: "\\kappa " },
      { label: "\\lambda", insert: "\\lambda " },
      { label: "\\mu", insert: "\\mu " },
      { label: "\\nu", insert: "\\nu " },
      { label: "\\xi", insert: "\\xi " },
      { label: "\\pi", insert: "\\pi " },
      { label: "\\rho", insert: "\\rho " },
      { label: "\\sigma", insert: "\\sigma " },
      { label: "\\tau", insert: "\\tau " },
      { label: "\\upsilon", insert: "\\upsilon " },
      { label: "\\phi", insert: "\\phi " },
      { label: "\\chi", insert: "\\chi " },
      { label: "\\psi", insert: "\\psi " },
      { label: "\\omega", insert: "\\omega " },
      { label: "\\Gamma", insert: "\\Gamma " },
      { label: "\\Delta", insert: "\\Delta " },
      { label: "\\Theta", insert: "\\Theta " },
      { label: "\\Lambda", insert: "\\Lambda " },
      { label: "\\Xi", insert: "\\Xi " },
      { label: "\\Pi", insert: "\\Pi " },
      { label: "\\Sigma", insert: "\\Sigma " },
      { label: "\\Upsilon", insert: "\\Upsilon " },
      { label: "\\Phi", insert: "\\Phi " },
      { label: "\\Psi", insert: "\\Psi " },
      { label: "\\Omega", insert: "\\Omega " },
    ],
  },
  {
    name: "Operators",
    keys: [
      { label: "+", insert: "+" },
      { label: "−", insert: "-" },
      { label: "×", insert: "\\times " },
      { label: "÷", insert: "\\div " },
      { label: "±", insert: "\\pm " },
      { label: "∓", insert: "\\mp " },
      { label: "·", insert: "\\cdot " },
      { label: "∗", insert: "\\ast " },
      { label: "=", insert: "=" },
      { label: "≠", insert: "\\neq " },
      { label: "≈", insert: "\\approx " },
      { label: "≡", insert: "\\equiv " },
      { label: "<", insert: "<" },
      { label: ">", insert: ">" },
      { label: "≤", insert: "\\leq " },
      { label: "≥", insert: "\\geq " },
      { label: "≪", insert: "\\ll " },
      { label: "≫", insert: "\\gg " },
      { label: "∞", insert: "\\infty " },
      { label: "∂", insert: "\\partial " },
      { label: "∇", insert: "\\nabla " },
      { label: "′", insert: "'" },
      { label: "″", insert: "''" },
      { label: "‴", insert: "'''" },
      { label: "ℏ", insert: "\\hbar " },
      { label: "°", insert: "^\\circ " },
      { label: "∠", insert: "\\angle " },
      { label: "⊥", insert: "\\perp " },
      { label: "∥", insert: "\\parallel " },
    ],
  },
  {
    name: "Calculus",
    keys: [
      { label: "\\int", insert: "\\int_{}^{}", title: "Integral" },
      { label: "\\iint", insert: "\\iint_{}^{}", title: "Double integral" },
      { label: "\\iiint", insert: "\\iiint_{}^{}", title: "Triple integral" },
      { label: "\\oint", insert: "\\oint_{}^{}", title: "Contour integral" },
      { label: "\\sum", insert: "\\sum_{}^{}", title: "Summation" },
      { label: "\\prod", insert: "\\prod_{}^{}", title: "Product" },
      { label: "\\lim", insert: "\\lim_{}", offset: -1, title: "Limit" },
      { label: "\\frac{d}{dx}", insert: "\\frac{d}{dx}" },
      { label: "\\frac{\\partial}{\\partial x}", insert: "\\frac{\\partial}{\\partial x}" },
      { label: "\\infty", insert: "\\infty " },
      { label: "\\to", insert: "\\to " },
      { label: "\\Rightarrow", insert: "\\Rightarrow " },
      { label: "\\Leftarrow", insert: "\\Leftarrow " },
      { label: "\\Leftrightarrow", insert: "\\Leftrightarrow " },
    ],
  },
  {
    name: "Functions",
    keys: [
      { label: "\\sin", insert: "\\sin " },
      { label: "\\cos", insert: "\\cos " },
      { label: "\\tan", insert: "\\tan " },
      { label: "\\cot", insert: "\\cot " },
      { label: "\\sec", insert: "\\sec " },
      { label: "\\csc", insert: "\\csc " },
      { label: "\\arcsin", insert: "\\arcsin " },
      { label: "\\arccos", insert: "\\arccos " },
      { label: "\\arctan", insert: "\\arctan " },
      { label: "\\sinh", insert: "\\sinh " },
      { label: "\\cosh", insert: "\\cosh " },
      { label: "\\tanh", insert: "\\tanh " },
      { label: "\\ln", insert: "\\ln " },
      { label: "\\log", insert: "\\log " },
      { label: "\\log_{}", insert: "\\log_{}", offset: -1 },
      { label: "\\exp", insert: "\\exp " },
      { label: "\\max", insert: "\\max " },
      { label: "\\min", insert: "\\min " },
      { label: "\\gcd", insert: "\\gcd " },
      { label: "\\lim", insert: "\\lim_{}", offset: -1 },
    ],
  },
  {
    name: "Sets & Logic",
    keys: [
      { label: "∈", insert: "\\in " },
      { label: "∉", insert: "\\notin " },
      { label: "∋", insert: "\\ni " },
      { label: "⊆", insert: "\\subseteq " },
      { label: "⊂", insert: "\\subset " },
      { label: "⊇", insert: "\\supseteq " },
      { label: "⊃", insert: "\\supset " },
      { label: "∪", insert: "\\cup " },
      { label: "∩", insert: "\\cap " },
      { label: "∅", insert: "\\emptyset " },
      { label: "∀", insert: "\\forall " },
      { label: "∃", insert: "\\exists " },
      { label: "∄", insert: "\\nexists " },
      { label: "¬", insert: "\\neg " },
      { label: "∧", insert: "\\land " },
      { label: "∨", insert: "\\lor " },
      { label: "⇒", insert: "\\Rightarrow " },
      { label: "⇔", insert: "\\Leftrightarrow " },
    ],
  },
  {
    name: "Matrices",
    keys: [
      { label: "pmatrix", insert: "\\begin{pmatrix}\n\n\\end{pmatrix}", offset: -16, title: "Parentheses matrix" },
      { label: "bmatrix", insert: "\\begin{bmatrix}\n\n\\end{bmatrix}", offset: -16, title: "Bracket matrix" },
      { label: "vmatrix", insert: "\\begin{vmatrix}\n\n\\end{vmatrix}", offset: -16, title: "Determinant" },
      { label: "cases", insert: "\\begin{cases}\n\n\\end{cases}", offset: -15, title: "Cases" },
      { label: "array", insert: "\\begin{array}{}\n\n\\end{array}", offset: -14, title: "Array" },
      { label: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", insert: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", title: "2x2 matrix example" },
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
      { label: "⇀", insert: "\\rightharpoonup " },
      { label: "⇁", insert: "\\rightharpoondown " },
      { label: "\\xrightarrow{}", insert: "\\xrightarrow{}", offset: -1 },
      { label: "\\xleftarrow{}", insert: "\\xleftarrow{}", offset: -1 },
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
      { label: "⁺", insert: "^+" },
      { label: "⁻", insert: "^-" },
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
      { label: "₊", insert: "_+" },
      { label: "₋", insert: "_-" },
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
