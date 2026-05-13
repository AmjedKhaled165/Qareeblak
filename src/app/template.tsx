"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
                duration: 0.4, 
                ease: [0.16, 1, 0.3, 1] // Custom ease-out cubic for app-like feel
            }}
            className="flex-1 flex flex-col"
        >
            {children}
        </motion.div>
    );
}
