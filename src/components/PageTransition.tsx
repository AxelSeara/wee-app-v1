import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";

export const PageTransition = ({ children }: PropsWithChildren) => (
  <motion.div
    initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
    transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
  >
    {children}
  </motion.div>
);
