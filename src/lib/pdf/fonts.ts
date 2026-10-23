import "server-only";
import { Font } from "@react-pdf/renderer";
import { NOTO_400, NOTO_700, NOTO_DEVA_400, NOTO_DEVA_700 } from "./fonts.generated";

// Noto Sans for text; the Devanagari face supplies the ₹ sign as a fallback. Registered once for every PDF.
const woff = (b64: string) => `data:font/woff;base64,${b64}`;
Font.register({ family: "Noto", fonts: [{ src: woff(NOTO_400) }, { src: woff(NOTO_700), fontWeight: 700 }] });
Font.register({ family: "NotoDeva", fonts: [{ src: woff(NOTO_DEVA_400) }, { src: woff(NOTO_DEVA_700), fontWeight: 700 }] });
Font.registerHyphenationCallback((w) => [w]);

export const PDF_FONT = ["Noto", "NotoDeva"] as unknown as string;
