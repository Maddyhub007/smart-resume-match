import { useEffect, useState } from "react";

interface MatchScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const MatchScoreRing = ({ score, size = "md", label = "Match" }: MatchScoreRingProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const sizeClasses = {
    sm: "w-20 h-20",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  const innerSizeClasses = {
    sm: "inset-1.5",
    md: "inset-2",
    lg: "inset-3",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-3xl",
    lg: "text-4xl",
  };

  const labelSizeClasses = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--success))";
    if (score >= 60) return "hsl(var(--accent))";
    if (score >= 40) return "hsl(var(--primary))";
    return "hsl(var(--destructive))";
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center`}
      style={{
        background: `conic-gradient(${getScoreColor(animatedScore)} ${animatedScore * 3.6}deg, hsl(var(--muted)) ${animatedScore * 3.6}deg)`,
        transition: "background 1s ease-out",
      }}
    >
      <div
        className={`absolute ${innerSizeClasses[size]} bg-card rounded-full flex flex-col items-center justify-center`}
      >
        <span className={`${textSizeClasses[size]} font-bold text-foreground`}>
          {animatedScore}%
        </span>
        <span className={`${labelSizeClasses[size]} text-muted-foreground font-medium uppercase tracking-wide`}>
          {label}
        </span>
      </div>
    </div>
  );
};

export default MatchScoreRing;
