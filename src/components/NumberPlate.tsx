import { formatReg } from "@/lib/regno";
import { cx } from "./ui";

/** Indian number plate look: white plate, black text, blue IND strip. */
export function NumberPlate({ reg, size = "md", className }: { reg: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={cx(
      "inline-flex items-stretch overflow-hidden rounded-[5px] border-2 border-[#111] bg-white font-mono font-bold tracking-wider whitespace-nowrap text-[#111] shadow-[inset_0_0_0_1px_#fff]",
      size === "sm" && "text-[12px]", size === "md" && "text-[14px]", size === "lg" && "text-2xl", className,
    )}>
      <span className={cx("flex flex-col items-center justify-center bg-[#1d4ed8] font-sans font-bold tracking-normal text-white",
        size === "lg" ? "px-1.5 text-[10px]" : "px-1 text-[7px]")}>IND</span>
      <span className={size === "lg" ? "px-3 py-1" : "px-2 py-0.5"}>{formatReg(reg)}</span>
    </span>
  );
}
