import { AnimatePresence, motion } from "framer-motion";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";

interface ToastProps {
  message: string | null;
}

export const Toast = ({ message }: ToastProps) => (
  <AnimatePresence>
    {message ? (
      <motion.div
        className="toast"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10, scale: 0.995 }}
        transition={{ duration: MOTION_DURATION.fast, ease: EASE_STANDARD }}
      >
        {message}
      </motion.div>
    ) : null}
  </AnimatePresence>
);
