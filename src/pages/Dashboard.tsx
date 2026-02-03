import { Link } from "react-router-dom";
import { ArrowRight, Download, RefreshCw, TrendingUp } from "lucide-react";
import Layout from "../components/layout/Layout";
import MatchScoreRing from "../components/ui/MatchScoreRing";
import SkillBreakdown from "../components/dashboard/SkillBreakdown";
import ImprovementTips from "../components/dashboard/ImprovementTips";
import SkillTag from "../components/ui/SkillTag";

// Mock data
const analysisData = {
  overallScore: 78,
  skillMatches: [
    { skill: "React.js", score: 95, status: "strong" as const },
    { skill: "TypeScript", score: 88, status: "strong" as const },
    { skill: "Node.js", score: 72, status: "moderate" as const },
    { skill: "System Design", score: 55, status: "weak" as const },
    { skill: "AWS Services", score: 45, status: "weak" as const },
  ],
  strongSkills: ["React", "TypeScript", "JavaScript", "CSS", "Git"],
  weakSkills: ["System Design", "AWS", "Kubernetes", "CI/CD"],
  tips: [
    {
      type: "warning" as const,
      skill: "System Design",
      message:
        "Consider adding more details about system architecture projects you've worked on.",
    },
    {
      type: "suggestion" as const,
      skill: "Cloud Services",
      message:
        "AWS certifications or projects using cloud services would significantly boost your profile.",
    },
    {
      type: "improvement" as const,
      skill: "DevOps",
      message:
        "Add CI/CD pipeline experience and containerization skills to attract more opportunities.",
    },
  ],
  topJobMatches: 24,
};

const Dashboard = () => {
  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="section-title mb-2">Resume Analysis</h1>
              <p className="text-muted-foreground">
                Your resume has been analyzed against current job market requirements.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-secondary text-sm py-2 px-4">
                <RefreshCw className="w-4 h-4" />
                Re-analyze
              </button>
              <button className="btn-secondary text-sm py-2 px-4">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* Main Score Card */}
          <div className="card-elevated p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <MatchScoreRing score={analysisData.overallScore} size="lg" label="Score" />

              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Good Match Potential
                </h2>
                <p className="text-muted-foreground mb-6 max-w-xl">
                  Your resume shows strong technical skills but could benefit from
                  improvements in cloud services and system design to access more
                  senior-level positions.
                </p>

                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <span className="font-medium text-success">
                      {analysisData.topJobMatches} matching jobs found
                    </span>
                  </div>
                  <Link to="/jobs" className="btn-primary text-sm py-2 px-4">
                    View Jobs
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Skill Breakdown - 2 cols */}
            <div className="lg:col-span-2">
              <SkillBreakdown skills={analysisData.skillMatches} />
            </div>

            {/* Skills Overview */}
            <div className="space-y-6">
              {/* Strong Skills */}
              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  Strong Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisData.strongSkills.map((skill) => (
                    <SkillTag key={skill} skill={skill} variant="accent" />
                  ))}
                </div>
              </div>

              {/* Weak Skills */}
              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" />
                  Skills to Improve
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisData.weakSkills.map((skill) => (
                    <SkillTag key={skill} skill={skill} variant="muted" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Improvement Tips */}
          <div className="mt-6">
            <ImprovementTips tips={analysisData.tips} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
