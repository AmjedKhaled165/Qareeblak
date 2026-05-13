"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PulseButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function PulseButton({
  children,
  onClick,
  className = "",
  disabled = false,
}: PulseButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
      }}
    >
      {children}
      <motion.div
        className="absolute inset-0 rounded-lg bg-white/20 -z-10"
        animate={{
          opacity: [0.5, 0, 0.5],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
        style={{ borderRadius: "inherit" }}
      />
    </motion.button>
  );
}
