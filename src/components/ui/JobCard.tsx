import { MapPin, Building2, Bookmark, ExternalLink } from "lucide-react";
import SkillTag from "./SkillTag";
import MatchScoreRing from "./MatchScoreRing";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  matchScore: number;
  skills: string[];
  experience: string;
  saved?: boolean;
}

interface JobCardProps {
  job: Job;
  onSave?: (id: string) => void;
  onApply?: (id: string) => void;
}

const JobCard = ({ job, onSave, onApply }: JobCardProps) => {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-start gap-4">
        {/* Company Logo Placeholder */}
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>

        {/* Job Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg text-foreground truncate">{job.title}</h3>
              <p className="text-muted-foreground font-medium">{job.company}</p>
            </div>
            <MatchScoreRing score={job.matchScore} size="sm" />
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{job.location}</span>
            </div>
            <span>•</span>
            <span>{job.experience}</span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {job.skills.slice(0, 4).map((skill) => (
              <SkillTag key={skill} skill={skill} variant="accent" size="sm" />
            ))}
            {job.skills.length > 4 && (
              <SkillTag skill={`+${job.skills.length - 4}`} variant="muted" size="sm" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => onApply?.(job.id)}
              className="btn-primary text-sm py-2 px-4 flex-1 sm:flex-none"
            >
              <ExternalLink className="w-4 h-4" />
              Apply Now
            </button>
            <button
              onClick={() => onSave?.(job.id)}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                job.saved
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <Bookmark className={`w-5 h-5 ${job.saved ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
