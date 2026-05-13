"use client";

import LetterGlitch from "@/components/ui/letter-glitch";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 z-0">
        <LetterGlitch
          glitchColors={["#1a2e1a", "#a3e635", "#4a7c3f"]}
          glitchSpeed={80}
          outerVignette={true}
          centerVignette={false}
          smooth={true}
        />
      </div>
      <div className="relative z-10 w-full max-w-[460px] mx-4">
        {children}
      </div>
    </div>
  );
}
