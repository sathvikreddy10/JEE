"use client";

import { useEffect, useRef } from "react";

export function CursorEffect() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(hover: none), (pointer: coarse)").matches) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let rx = mx;
    let ry = my;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    };

    const onDown = () => ring.classList.add("is-down");
    const onUp = () => ring.classList.remove("is-down");

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("a, button, [data-magnetic], .quiz-option"))
        ring.classList.add("is-hover");
    };
    const onOut = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("a, button, [data-magnetic], .quiz-option"))
        ring.classList.remove("is-hover");
    };

    addEventListener("mousemove", onMove);
    addEventListener("mousedown", onDown);
    addEventListener("mouseup", onUp);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    requestAnimationFrame(loop);

    return () => {
      removeEventListener("mousemove", onMove);
      removeEventListener("mousedown", onDown);
      removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor" />
      <div ref={dotRef} className="cursor-dot" />
    </>
  );
}
