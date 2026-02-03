import { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: "primary" | "accent" | "success";
  animate?: boolean;
}

const ProgressBar = ({
  value,
  max = 100,
  label,
  showValue = true,
  variant = "primary",
  animate = true,
}: ProgressBarProps) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setAnimatedWidth(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedWidth(percentage);
    }
  }, [percentage, animate]);

  const variantClasses = {
    primary: "gradient-primary",
    accent: "gradient-accent",
    success: "bg-success",
  };

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          {showValue && (
            <span className="text-sm font-semibold text-muted-foreground">{value}%</span>
          )}
        </div>
      )}
      <div className="progress-bar">
        <div
          className={`progress-fill ${variantClasses[variant]}`}
          style={{
            width: `${animatedWidth}%`,
            transition: animate ? "width 1s ease-out" : "none",
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
