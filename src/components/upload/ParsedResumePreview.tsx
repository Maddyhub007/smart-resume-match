import { User, Briefcase, GraduationCap, Mail, Phone, MapPin, Star } from "lucide-react";
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
  return (
    <div className="space-y-5">
      {/* ── Header Card ── */}
      <div className="card-elevated p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-md">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {resume.name || "—"}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                  {resume.email && (
                    <a
                      href={`mailto:${resume.email}`}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {resume.email}
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

      {/* ── Summary ── */}
      {resume.summary && (
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full gradient-primary inline-block" />
            Professional Summary
          </h3>
          <p className="text-muted-foreground leading-relaxed">{resume.summary}</p>
        </div>
      )}

      {/* ── Skills ── */}
      {resume.skills?.length > 0 && (
        <div className="card-elevated p-6">
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

      {/* ── Experience & Education side by side on large screens ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Experience */}
        {resume.experience?.length > 0 && (
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-primary" />
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

        {/* Education */}
        {resume.education?.length > 0 && (
          <div className="card-elevated p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <GraduationCap className="w-4.5 h-4.5 text-accent" />
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
    </div>
  );
};

export default ParsedResumePreview;
