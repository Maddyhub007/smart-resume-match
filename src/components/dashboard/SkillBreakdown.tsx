import ProgressBar from "../ui/ProgressBar";

interface SkillMatch {
  skill: string;
  score: number;
  status: "strong" | "moderate" | "weak";
}

interface SkillBreakdownProps {
  skills: SkillMatch[];
}

const SkillBreakdown = ({ skills }: SkillBreakdownProps) => {
  const getVariant = (status: string) => {
    switch (status) {
      case "strong":
        return "success" as const;
      case "moderate":
        return "accent" as const;
      default:
        return "primary" as const;
    }
  };

  return (
    <div className="card-elevated p-6">
      <h3 className="font-semibold text-foreground mb-6">Skill Match Breakdown</h3>
      <div className="space-y-5">
        {skills.map((skill, index) => (
          <ProgressBar
            key={index}
            value={skill.score}
            label={skill.skill}
            variant={getVariant(skill.status)}
          />
        ))}
      </div>
    </div>
  );
};

export default SkillBreakdown;
