import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";

export const PageTransition = ({ children }: PropsWithChildren) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
  >
    {children}
  </motion.div>
);
