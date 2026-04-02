import { Trophy, Crown, Medal } from "lucide-react";
import MatchScoreRing from "../ui/MatchScoreRing";

interface Applicant {
  id: string;
  match_score: number;
  candidateProfile?: { full_name?: string; email?: string } | null;
  resumes?: { parsed_name?: string } | null;
  status: string;
}

interface TopApplicantsProps {
  applicants: Applicant[];
}

const TopApplicants = ({ applicants }: TopApplicantsProps) => {
  const top = applicants
    .filter((a) => a.status !== "rejected")
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5);

  if (top.length === 0) return null;

  const getRankIcon = (idx: number) => {
    if (idx === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (idx === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (idx === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs font-bold text-muted-foreground w-4 text-center">#{idx + 1}</span>;
  };

  return (
    <div className="card-elevated p-5 mb-6">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-500" />
        Top Candidates
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {top.map((app, idx) => {
          const name = app.candidateProfile?.full_name || (app.resumes as any)?.parsed_name || "Unknown";
          return (
            <div
              key={app.id}
              className="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border min-w-[100px]"
            >
              <div className="flex items-center gap-1">
                {getRankIcon(idx)}
              </div>
              <MatchScoreRing score={app.match_score || 0} size="sm" />
              <p className="text-xs font-medium text-foreground text-center truncate w-full">{name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopApplicants;
