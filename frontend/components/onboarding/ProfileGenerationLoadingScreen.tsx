"use client";

import { motion } from "motion/react";

export default function ProfileGenerationLoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center p-8 z-50 fixed inset-0">
      <div className="w-16 h-16 mb-6 relative">
        {/* Simple spinner */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-full h-full text-[#FF385C] animate-spin"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 mb-2"
      >
        Building your travel profile
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-gray-500 max-w-md"
      >
        Using AI to synthesize your travel history into a personalized agent memory.
        This takes a few seconds...
      </motion.p>
    </div>
  );
}
