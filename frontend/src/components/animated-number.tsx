import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/**
 * Spring-driven count-up. SSR renders the final value (no layout shift / no
 * flash of zero for crawlers); the animation only kicks in on the client once
 * the element scrolls into view. Honors prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => format(value));
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!mounted.current) return;
    if (reduce || !inView) {
      setDisplay(format(value));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(format(latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
