"use client";

import { useEffect, useState, useRef } from "react";

export function Preloader() {
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      setMounted(true);
      document.body.classList.add("is-loaded");
      return;
    }
    setMounted(true);
    let n = 0;
    const tick = () => {
      n = Math.min(100, n + Math.ceil(Math.random() * 12));
      setCount(n);
      if (n < 100) {
        setTimeout(tick, 70 + Math.random() * 90);
      } else {
        setTimeout(() => {
          setDone(true);
          document.body.classList.add("is-loaded");
        }, 350);
      }
    };
    tick();
  }, []);

  useEffect(() => {
    if (done && ref.current) {
      const timer = setTimeout(() => setMounted(false), 1100);
      return () => clearTimeout(timer);
    }
  }, [done]);

  if (!mounted) return null;

  return (
    <div ref={ref} className={`preloader${done ? " is-done" : ""}`} aria-hidden="true">
      <div className="preloader__inner">
        <span className="preloader__word">Testify</span>
        <span className="preloader__count">
          {String(count).padStart(2, "0")}
        </span>
      </div>
      <div className="preloader__bar">
        <span style={{ width: `${count}%` }} />
      </div>
    </div>
  );
}
