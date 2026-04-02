import { CheckCircle, XCircle } from "lucide-react";

interface SkillMatchBreakdownProps {
  candidateSkills: string[];
  jobSkills: string[];
  compact?: boolean;
}

const SkillMatchBreakdown = ({ candidateSkills, jobSkills, compact = false }: SkillMatchBreakdownProps) => {
  const candidateLower = candidateSkills.map((s) => s.toLowerCase());
  const matched = jobSkills.filter((s) => candidateLower.includes(s.toLowerCase()));
  const missed = jobSkills.filter((s) => !candidateLower.includes(s.toLowerCase()));

  if (jobSkills.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No required skills specified for this job.</p>;
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {matched.length > 0 && (
        <div>
          <p className="text-xs font-medium text-success flex items-center gap-1 mb-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Matched Skills ({matched.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matched.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium border border-success/20">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {missed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-destructive flex items-center gap-1 mb-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Missing Skills ({missed.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missed.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium border border-destructive/20">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillMatchBreakdown;
