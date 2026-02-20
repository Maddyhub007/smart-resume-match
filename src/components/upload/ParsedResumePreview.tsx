import { User, Briefcase, GraduationCap, Mail, Phone, MapPin, Star, Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";
import SkillTag from "../ui/SkillTag";

interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  summary: string;
  overall_score?: number;
  improvement_tips?: {
    type: "warning" | "suggestion" | "improvement";
    skill: string;
    message: string;
  }[];
}

interface ParsedResumePreviewProps {
  resume: ParsedResume;
}

const ScoreRing = ({ score }: { score: number }) => {
  const color =
    score >= 75 ? "text-accent" : score >= 50 ? "text-primary" : "text-destructive";
  const bg =
    score >= 75 ? "bg-accent/10" : score >= 50 ? "bg-primary/10" : "bg-destructive/10";
  const label =
    score >= 75 ? "Excellent" : score >= 50 ? "Good" : "Needs Work";

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${bg} border border-border`}>
      <Star className={`w-5 h-5 ${color} fill-current`} />
      <div>
        <p className={`text-2xl font-bold leading-none ${color}`}>{score}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
};

const ParsedResumePreview = ({ resume }: ParsedResumePreviewProps) => {
  const getTipIcon = (type: string) => {
    switch (type) {
      case "warning": return AlertTriangle;
      case "suggestion": return Lightbulb;
      default: return TrendingUp;
    }
  };

  const getTipStyles = (type: string) => {
    switch (type) {
      case "warning": return "bg-destructive/10 text-destructive border-destructive/20";
      case "suggestion": return "bg-accent/10 text-accent border-accent/20";
      default: return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="card-elevated p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-md">
            <User className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  {resume.name || "—"}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                  {resume.email && (
                    <a
                      href={`mailto:${resume.email}`}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">{resume.email}</span>
                    </a>
                  )}
                  {resume.phone && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      {resume.phone}
                    </span>
                  )}
                  {resume.location && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {resume.location}
                    </span>
                  )}
                </div>
              </div>
              {resume.overall_score !== undefined && resume.overall_score > 0 && (
                <ScoreRing score={resume.overall_score} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <div className="card-elevated p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full gradient-primary inline-block" />
            Professional Summary
          </h3>
          <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">{resume.summary}</p>
        </div>
      )}

      {/* Skills */}
      {resume.skills?.length > 0 && (
        <div className="card-elevated p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full gradient-primary inline-block" />
            Skills
            <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {resume.skills.length} skills
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, i) => (
              <SkillTag
                key={i}
                skill={skill}
                variant={i % 3 === 0 ? "primary" : i % 3 === 1 ? "accent" : "muted"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Experience & Education */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {resume.experience?.length > 0 && (
          <div className="card-elevated p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Experience
              <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {resume.experience.length}
              </span>
            </h3>
            <div className="space-y-4">
              {resume.experience.map((exp, i) => (
                <div key={i} className="relative pl-5">
                  <span
                    className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${
                      i === 0 ? "gradient-primary" : "bg-border"
                    }`}
                  />
                  {i < resume.experience.length - 1 && (
                    <span className="absolute left-[3px] top-4 bottom-[-12px] w-px bg-border" />
                  )}
                  <p className="font-semibold text-foreground text-sm leading-snug">{exp.title}</p>
                  <p className="text-primary text-sm font-medium">{exp.company}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{exp.duration}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.education?.length > 0 && (
          <div className="card-elevated p-4 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-accent" />
              Education
              <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {resume.education.length}
              </span>
            </h3>
            <div className="space-y-4">
              {resume.education.map((edu, i) => (
                <div key={i} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-accent" />
                  {i < resume.education.length - 1 && (
                    <span className="absolute left-[3px] top-4 bottom-[-12px] w-px bg-border" />
                  )}
                  <p className="font-semibold text-foreground text-sm leading-snug">{edu.degree}</p>
                  <p className="text-accent text-sm font-medium">{edu.institution}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{edu.year}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Improvement Tips */}
      {resume.improvement_tips && resume.improvement_tips.length > 0 && (
        <div className="card-elevated p-4 sm:p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-accent" />
            Personalized Improvement Tips
          </h3>
          <div className="space-y-3">
            {resume.improvement_tips.map((tip, index) => {
              const Icon = getTipIcon(tip.type);
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${getTipStyles(tip.type)}`}
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
      )}
    </div>
  );
};

export default ParsedResumePreview;