"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  animated?: boolean;
}

export function GradientText({
  children,
  className = "",
  animated = false,
}: GradientTextProps) {
  const baseClass =
    "text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-violet-600 dark:from-primary dark:via-indigo-400 dark:to-violet-500";

  if (!animated) {
    return <span className={`${baseClass} ${className}`}>{children}</span>;
  }

  return (
    <motion.span
      className={`${baseClass} ${className}`}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        backgroundSize: "200% 200%",
      }}
    >
      {children}
    </motion.span>
  );
}
