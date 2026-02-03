interface SkillTagProps {
  skill: string;
  variant?: "primary" | "accent" | "muted";
  size?: "sm" | "md";
}

const SkillTag = ({ skill, variant = "primary", size = "md" }: SkillTagProps) => {
  const variantClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    muted: "bg-muted text-muted-foreground",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {skill}
    </span>
  );
};

export default SkillTag;
