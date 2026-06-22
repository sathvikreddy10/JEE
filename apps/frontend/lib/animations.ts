import { Variants, Transition } from "framer-motion";

// ─── Staggered container (wrap around children with motion.div + whileInView) ───

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

// ─── Slide-up fade-in for individual children ───

export const slideUpFade: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20, mass: 0.8 },
  },
};

// ─── Scale-in for cards ───

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 18 },
  },
};

// ─── Springy hover + tap for interactive elements ───

export const hoverTap = {
  whileHover: { scale: 1.02, transition: { type: "spring" as const, stiffness: 300, damping: 15 } },
  whileTap: { scale: 0.98 },
};

// ─── Magnetic hover effect (slight rotate) ───

export const magneticHover = {
  whileHover: { scale: 1.03, transition: { type: "spring" as const, stiffness: 250, damping: 12 } },
  whileTap: { scale: 0.97 },
};

// ─── Spring transition for layout animations ───

export const springTransition: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

// ─── Card hover (subtle lift + shadow) ───

export const cardHover = {
  whileHover: {
    y: -4,
    boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
    transition: { type: "spring" as const, stiffness: 250, damping: 18 },
  },
  whileTap: { scale: 0.99 },
};

// ─── Staggered reveal for list items ───

export const listItem: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, type: "spring", stiffness: 100, damping: 20 },
  }),
};
