import { MapPin, Building2, ExternalLink, Clock, Globe, Sparkles } from "lucide-react";
import SkillTag from "./SkillTag";
import MatchScoreRing from "./MatchScoreRing";

interface ExternalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  skills: string[];
  experience: string;
  jobType: string;
  description: string;
  source: string;
  postedAt: string;
  salary?: string;
  matchScore?: number;
}

const ExternalJobCard = ({ job, onOptimize }: { job: ExternalJob; onOptimize?: () => void }) => {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <div className="card-elevated p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base sm:text-lg text-foreground truncate">{job.title}</h3>
              <p className="text-muted-foreground font-medium text-sm">{job.company}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {job.matchScore !== undefined && job.matchScore > 0 && (
                <MatchScoreRing score={job.matchScore} size="sm" />
              )}
              <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground whitespace-nowrap">
                {job.source}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{job.location}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>{job.experience}</span>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeAgo(job.postedAt)}</span>
            </div>
            {job.salary && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="text-primary font-medium">{job.salary}</span>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.skills.slice(0, 5).map((skill) => (
              <SkillTag key={skill} skill={skill} variant="accent" size="sm" />
            ))}
            {job.skills.length > 5 && (
              <SkillTag skill={`+${job.skills.length - 5}`} variant="muted" size="sm" />
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              View & Apply
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onOptimize && (
              <button onClick={onOptimize} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Optimize Resume
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExternalJobCard;
