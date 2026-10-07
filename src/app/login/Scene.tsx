"use client";

import { motion, type Variants } from "motion/react";
import { BadgeCheck, CircleDashed, MessageCircle, ReceiptIndianRupee } from "lucide-react";
import { NumberPlate } from "@/components/NumberPlate";

/*
 * Sign-in illustration: a line-drawn motorcycle with a parts bill and a used-bike card floating over it.
 * Everything is drawn in code with the theme's colours (white lines on the dark panel, brand green accents).
 * The figures on the cards are examples, not shop data.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const pop = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE, delay } },
});

/** Slow up-and-down drift so the cards feel alive; turned off by MotionConfig for reduced motion. */
const float = (distance: number, duration: number) => ({
  animate: { y: [0, -distance, 0] },
  transition: { duration, ease: "easeInOut" as const, repeat: Infinity },
});

export function Scene() {
  return (
    <div className="relative mt-8 min-h-[260px] w-full flex-1 [@media(max-height:820px)]:mt-5 [@media(max-height:820px)]:min-h-[225px]" aria-hidden>
      <motion.div variants={pop(0.5)} className="absolute inset-x-0 bottom-0 mx-auto h-[250px] max-w-[560px] text-white [@media(max-height:820px)]:h-[215px]">
        <Motorcycle />
      </motion.div>

      <motion.div variants={pop(0.85)} className="absolute bottom-2 left-0 z-10 w-[236px]">
        <motion.div {...float(6, 5.5)}><InvoiceCard /></motion.div>
      </motion.div>

      <motion.div variants={pop(1.05)} className="absolute top-0 right-0 z-10 w-[226px]">
        <motion.div {...float(8, 6.5)}><BikeCard /></motion.div>
      </motion.div>
    </div>
  );
}

const card = "rounded-xl bg-side/80 p-3.5 text-[12px] text-side-ink shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-md";

function InvoiceCard() {
  return (
    <motion.div whileHover={{ y: -4 }} className={card}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-white"><ReceiptIndianRupee className="h-3.5 w-3.5 text-primary" /> Tax invoice</span>
        <span className="font-mono text-[10.5px]">INV/26-27/00418</span>
      </div>
      <dl className="num mt-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="truncate">Clutch plate set × 2</dt><dd className="text-right text-white">₹2,480</dd>
        <dt className="truncate">Brake shoe · Splendor+</dt><dd className="text-right text-white">₹760</dd>
        <dt className="truncate">Chain sprocket kit</dt><dd className="text-right text-white">₹845</dd>
        <dt className="text-side-ink/70">CGST + SGST 18%</dt><dd className="text-right text-side-ink/70">₹735</dd>
        <dt className="mt-1 border-t border-white/10 pt-1.5 font-semibold text-white">Total</dt>
        <dd className="mt-1 border-t border-white/10 pt-1.5 text-right text-[14px] font-bold text-primary">₹4,820</dd>
      </dl>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-semibold text-primary">Paid · UPI</span>
        <span className="flex items-center gap-1 text-[10.5px]"><MessageCircle className="h-3 w-3" /> PDF sent on WhatsApp</span>
      </div>
    </motion.div>
  );
}

function BikeCard() {
  return (
    <motion.div whileHover={{ y: -4 }} className={card}>
      <NumberPlate reg="TN63AB2222" size="sm" />
      <p className="mt-2 text-[13px] font-semibold text-white">Royal Enfield Classic 350</p>
      <p>2022 · 18,400 km · 1st owner</p>
      <ul className="mt-2 flex flex-col gap-1">
        <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> RC original · insurance valid</li>
        <li className="flex items-center gap-1.5"><CircleDashed className="h-3.5 w-3.5 text-primary" /> Loan closed · NOC received</li>
      </ul>
      <div className="mt-2.5 flex items-end justify-between border-t border-white/10 pt-2">
        <div><p className="text-[10.5px]">Our price</p><p className="num text-[14px] font-bold text-white">₹1,78,000</p></div>
        <p className="num text-right text-[10.5px]">Profit<br /><span className="text-[12px] font-semibold text-primary">₹14,200</span></p>
      </div>
    </motion.div>
  );
}

/* ---------- Line-drawn motorcycle with turning wheels and passing road marks ---------- */
function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="58" />
      <circle cx={cx} cy={cy} r="47" strokeOpacity="0.6" />
      <motion.g style={{ transformBox: "fill-box", transformOrigin: "center" }} animate={{ rotate: 360 }} transition={{ duration: 3.2, ease: "linear", repeat: Infinity }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i} x1={(cx + 9 * Math.cos(a)).toFixed(2)} y1={(cy + 9 * Math.sin(a)).toFixed(2)} x2={(cx + 47 * Math.cos(a)).toFixed(2)} y2={(cy + 47 * Math.sin(a)).toFixed(2)} strokeOpacity="0.55" />;
        })}
        <circle cx={cx} cy={cy - 47} r="0.5" />
      </motion.g>
      <circle cx={cx} cy={cy} r="9" />
    </g>
  );
}

function Motorcycle() {
  return (
    <svg viewBox="0 0 560 300" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.22">
      {/* road */}
      <motion.line x1="10" y1="286" x2="550" y2="286" strokeDasharray="18 14" strokeOpacity="0.18"
        animate={{ strokeDashoffset: [0, 64] }} transition={{ duration: 1.2, ease: "linear", repeat: Infinity }} />
      {[[40, 190], [20, 214], [55, 238]].map(([x, y], i) => (
        <motion.line key={i} x1={x} y1={y} x2={x + 34} y2={y} strokeOpacity="0.3"
          animate={{ x: [12, -24], opacity: [0, 1, 0] }} transition={{ duration: 1.6, ease: "easeOut", repeat: Infinity, delay: i * 0.35 }} />
      ))}

      <Wheel cx={130} cy={226} />
      <Wheel cx={432} cy={226} />

      {/* mudguards */}
      <path d="M76 204 A58 58 0 0 1 156 170" />
      <path d="M382 196 A58 58 0 0 1 476 190" />
      {/* swingarm, shock, frame */}
      <path d="M130 226 L252 212" />
      <path d="M164 148 L198 208 M173 145 L207 205" strokeOpacity="0.3" />
      <path d="M262 132 L352 118 M352 120 L318 196 M262 132 L252 212" />
      {/* tail and seat */}
      <path d="M98 152 L170 132 L262 126" />
      <path d="M158 130 Q200 106 264 114 L264 128 Q206 122 168 138 Z" fill="currentColor" fillOpacity="0.07" />
      {/* tank */}
      <path d="M262 114 Q292 84 342 92 Q368 98 362 122 Q332 136 270 132 Z" fill="currentColor" fillOpacity="0.09" />
      {/* engine */}
      <rect x="250" y="158" width="80" height="58" rx="12" />
      <path d="M264 166 L264 208 M277 164 L277 210 M290 164 L290 210" strokeOpacity="0.3" />
      {/* exhaust */}
      <path d="M322 210 C 310 240, 270 242, 232 242 L102 238" />
      <path d="M102 233 L70 229 L70 245 L102 243" />
      {/* fork, handlebar, mirror */}
      <path d="M372 100 L428 222 M382 96 L438 218" />
      <path d="M374 98 L371 70 M354 70 Q370 63 394 70" />
      <path d="M360 66 L352 48" strokeOpacity="0.3" /><circle cx="350" cy="43" r="6" strokeOpacity="0.3" />
      {/* footpeg */}
      <path d="M286 224 L304 224" />
      {/* headlight in brand green */}
      <circle cx="400" cy="108" r="14" />
      <motion.circle cx="400" cy="108" r="7" className="text-primary" stroke="currentColor" strokeOpacity="1" fill="currentColor" fillOpacity="0.35"
        animate={{ fillOpacity: [0.2, 0.55, 0.2] }} transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }} />
    </svg>
  );
}
