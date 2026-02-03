import { Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";

interface Tip {
  type: "warning" | "suggestion" | "improvement";
  skill: string;
  message: string;
}

interface ImprovementTipsProps {
  tips: Tip[];
}

const ImprovementTips = ({ tips }: ImprovementTipsProps) => {
  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return AlertTriangle;
      case "suggestion":
        return Lightbulb;
      default:
        return TrendingUp;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "suggestion":
        return "bg-accent/10 text-accent border-accent/20";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <div className="card-elevated p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-accent" />
        Improvement Tips
      </h3>
      <div className="space-y-3">
        {tips.map((tip, index) => {
          const Icon = getIcon(tip.type);
          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-4 rounded-xl border ${getStyles(tip.type)}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{tip.skill}</p>
                <p className="text-sm opacity-80 mt-1">{tip.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImprovementTips;
