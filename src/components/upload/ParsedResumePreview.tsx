import { User, Briefcase, GraduationCap, Mail, Phone, MapPin } from "lucide-react";
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
}

interface ParsedResumePreviewProps {
  resume: ParsedResume;
}

const ParsedResumePreview = ({ resume }: ParsedResumePreviewProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">{resume.name}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              {resume.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{resume.email}</span>
                </div>
              )}
              {resume.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{resume.phone}</span>
                </div>
              )}
              {resume.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{resume.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-3">Summary</h3>
          <p className="text-muted-foreground leading-relaxed">{resume.summary}</p>
        </div>
      )}

      {/* Skills */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-4">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {resume.skills.map((skill, index) => (
            <SkillTag key={index} skill={skill} variant={index % 2 === 0 ? "primary" : "accent"} />
          ))}
        </div>
      </div>

      {/* Experience */}
      {resume.experience.length > 0 && (
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Experience
          </h3>
          <div className="space-y-4">
            {resume.experience.map((exp, index) => (
              <div
                key={index}
                className={`pl-4 border-l-2 ${
                  index === 0 ? "border-primary" : "border-border"
                }`}
              >
                <p className="font-medium text-foreground">{exp.title}</p>
                <p className="text-muted-foreground text-sm">{exp.company}</p>
                <p className="text-muted-foreground text-xs mt-1">{exp.duration}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education.length > 0 && (
        <div className="card-elevated p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Education
          </h3>
          <div className="space-y-4">
            {resume.education.map((edu, index) => (
              <div key={index} className="pl-4 border-l-2 border-border">
                <p className="font-medium text-foreground">{edu.degree}</p>
                <p className="text-muted-foreground text-sm">{edu.institution}</p>
                <p className="text-muted-foreground text-xs mt-1">{edu.year}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ParsedResumePreview;
