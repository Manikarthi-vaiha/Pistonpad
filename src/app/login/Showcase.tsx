"use client";

import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, MotionConfig, useInView, useReducedMotion, type Variants } from "motion/react";
import { Bike, Boxes, FileCheck2, ReceiptIndianRupee, ShieldAlert } from "lucide-react";
import { Scene } from "./Scene";

/*
 * Motion for the sign-in screen only. Colours come from the existing theme tokens; nothing here is used after login.
 * MotionConfig reducedMotion="user" turns movement off for people who ask their device to reduce motion, and every
 * animation ends in the same final, readable state, so content and focus are never left hidden.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Left panel of the sign-in page: what the app does for both businesses. */
export function Showcase() {
  return (
    <MotionConfig reducedMotion="user">
      <Glow />
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 my-8 flex flex-1 flex-col [@media(max-height:820px)]:my-5">
        <div className="max-w-lg">
          <motion.p variants={item} className="text-[13px] font-semibold tracking-[0.2em] text-primary uppercase">
            Spare parts wholesale · Used bikes
          </motion.p>
          <Headline />
          <motion.p variants={item} className="mt-4 text-[15px] leading-relaxed">
            Bill spare parts with GST in seconds, and run your second-hand bike trade from the same place: papers, loans,
            service work and the real profit on every bike.
          </motion.p>
          <motion.div variants={item} className="mt-6"><Ticker /></motion.div>
        </div>
        <Scene />
      </motion.div>
      <Stats />
      <Gears />
    </MotionConfig>
  );
}

/* ---------- Headline: words rise into place, then a line draws under "tracked." ---------- */
function Headline() {
  const line = (text: string, start: number) =>
    text.split(" ").map((w, i) => (
      <span key={w + i} className="inline-block overflow-hidden pb-1 align-bottom">
        <motion.span className="inline-block" variants={{ hidden: { y: "105%" }, show: { y: 0, transition: { duration: 0.7, ease: EASE, delay: start + i * 0.06 } } }}>
          {w}
        </motion.span>
        {" "}
      </span>
    ));
  return (
    <motion.h1 variants={{ hidden: {}, show: {} }} className="mt-4 text-4xl leading-tight font-bold text-white">
      {line("One shop, two businesses.", 0.2)}
      <br />
      {line("Every rupee", 0.45)}
      <span className="relative inline-block overflow-hidden pb-1 align-bottom">
        <motion.span className="relative inline-block" variants={{ hidden: { y: "105%" }, show: { y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.57 } } }}>
          tracked.
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden className="absolute -bottom-1 left-0 h-2.5 w-full text-primary">
            <motion.path d="M2 8 C 50 2, 120 2, 198 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
              variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.9, ease: EASE, delay: 1.1 } } }} />
          </svg>
        </motion.span>
      </span>
    </motion.h1>
  );
}

/* ---------- A rotating line of example shop activity (illustrative, not real data) ---------- */
const ACTIVITY = [
  { icon: ReceiptIndianRupee, text: "INV/26-27/00418 · ₹4,820 · paid by UPI" },
  { icon: Bike, text: "Royal Enfield Classic 350 sold · profit ₹14,200" },
  { icon: Boxes, text: "Clutch plate set · Pulsar 150 · 12 in stock" },
  { icon: FileCheck2, text: "TN 76 AB 1234 · NOC received from Shriram" },
  { icon: ShieldAlert, text: "Insurance due in 9 days · TN 59 BZ 9087" },
];

function Ticker() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % ACTIVITY.length), 2800);
    return () => clearInterval(t);
  }, [reduce]);
  const a = ACTIVITY[i];
  return (
    <div aria-hidden className="flex w-full max-w-md items-center gap-3 rounded-full bg-white/[0.04] py-2 pr-4 pl-2.5 ring-1 ring-white/10">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <span className="relative h-5 min-w-0 flex-1 overflow-hidden text-[13px] text-white/90">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={i} className="flex items-center gap-2 whitespace-nowrap"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <a.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{a.text}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

/* ---------- Stats: numbers count up once they're on screen ---------- */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduce) { ref.current.textContent = `${to}${suffix}`; return; }
    const c = animate(0, to, { duration: 1.4, ease: EASE, onUpdate: (v) => { if (ref.current) ref.current.textContent = `${Math.round(v)}${suffix}`; } });
    return () => c.stop();
  }, [inView, reduce, to, suffix]);
  // Server and no-JS render show the final value.
  return <span ref={ref}>{to}{suffix}</span>;
}

function Stats() {
  const stats = [
    { value: <CountUp to={10} suffix=" lakh+" />, label: "parts, searched instantly" },
    { value: "Every bike", label: "papers, loans and history" },
    { value: <CountUp to={3} suffix=" reports" />, label: "parts, bikes and combined profit" },
  ];
  return (
    <motion.dl initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.9 }}
      className="relative z-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm [@media(max-height:820px)]:hidden">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="text-xl font-bold text-white tabular-nums">{s.value}</dt>
          <dd className="mt-1">{s.label}</dd>
        </div>
      ))}
    </motion.dl>
  );
}

/* ---------- Background: two sprockets turning slowly and a faint drifting glow ---------- */
function sprocket(teeth: number, outer: number, inner: number) {
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (i / (teeth * 2)) * Math.PI * 2;
    // Rounded so the server and the browser produce identical markup (trig results can differ in the last digits).
    return `${(300 + r * Math.cos(a)).toFixed(2)},${(300 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

function Gear({ teeth }: { teeth: number }) {
  return (
    <svg viewBox="0 0 600 600" className="h-full w-full">
      <polygon points={sprocket(teeth, 272, 250)} fill="none" stroke="white" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="300" cy="300" r="180" fill="none" stroke="white" strokeWidth="6" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return <circle key={i} cx={(300 + 110 * Math.cos(a)).toFixed(2)} cy={(300 + 110 * Math.sin(a)).toFixed(2)} r="38" fill="none" stroke="white" strokeWidth="6" />;
      })}
      <circle cx="300" cy="300" r="42" fill="none" stroke="white" strokeWidth="6" />
    </svg>
  );
}

function Gears() {
  return (
    <div aria-hidden className="pointer-events-none">
      <motion.div className="absolute -right-40 -bottom-40 h-[560px] w-[560px] opacity-[0.05]"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 0.05, scale: 1, rotate: 360 }}
        transition={{ opacity: { duration: 1.2 }, scale: { duration: 1.2, ease: EASE }, rotate: { duration: 90, ease: "linear", repeat: Infinity } }}>
        <Gear teeth={28} />
      </motion.div>
    </div>
  );
}

function Glow() {
  return (
    <motion.div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl"
      animate={{ x: [0, 80, 20, 0], y: [0, 40, 100, 0] }} transition={{ duration: 22, ease: "easeInOut", repeat: Infinity }} />
  );
}
