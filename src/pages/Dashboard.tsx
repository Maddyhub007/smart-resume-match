import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw, TrendingUp, Loader2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import MatchScoreRing from "../components/ui/MatchScoreRing";
import SkillBreakdown from "../components/dashboard/SkillBreakdown";
import ImprovementTips from "../components/dashboard/ImprovementTips";
import SkillTag from "../components/ui/SkillTag";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user } = useAuth();
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobCount, setJobCount] = useState(0);
  const [parsedTips, setParsedTips] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchLatestResume();
  }, [user]);

  const fetchLatestResume = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setResume(data);

    // Check localStorage for cached tips from parsing
    if (data?.id) {
      const cached = localStorage.getItem(`resume_tips_${data.id}`);
      if (cached) {
        try { setParsedTips(JSON.parse(cached)); } catch (_) {}
      }
    }

    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    setJobCount(count || 0);

    setLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!resume) {
    return (
      <Layout>
        <div className="py-12 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="section-title mb-4">No Resume Found</h1>
            <p className="text-muted-foreground mb-6">Upload your resume to get AI-powered analysis.</p>
            <Link to="/upload" className="btn-primary">
              Upload Resume <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const skills = (resume.parsed_skills || []);
  const score = resume.overall_score || 0;
  const strongSkills = skills.slice(0, Math.ceil(skills.length * 0.6));
  const weakSkills = skills.slice(Math.ceil(skills.length * 0.6));

  const skillMatches = skills.slice(0, 5).map((skill: string, i: number) => ({
    skill,
    score: Math.max(100 - i * 12, 30),
    status: i < 2 ? "strong" as const : i < 4 ? "moderate" as const : "weak" as const,
  }));

  // Use personalized tips from AI if available, otherwise generate from resume data
  const tips = parsedTips && parsedTips.length > 0 ? parsedTips : generateTipsFromResume(resume);

  return (
    <Layout>
      <div className="py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="section-title mb-2">Resume Analysis</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Analysis for: {resume.file_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchLatestResume} className="btn-secondary text-sm py-2 px-4">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="card-elevated p-6 sm:p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-center gap-6 sm:gap-8">
              <MatchScoreRing score={score} size="lg" label="Score" />
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                  {score >= 80 ? "Excellent Profile" : score >= 60 ? "Good Match Potential" : "Needs Improvement"}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-xl text-sm sm:text-base">
                  {resume.parsed_summary || "Your resume has been analyzed against current job market requirements."}
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <span className="font-medium text-success text-sm">{jobCount} jobs available</span>
                  </div>
                  <Link to="/jobs" className="btn-primary text-sm py-2 px-4">
                    View Jobs <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SkillBreakdown skills={skillMatches} />
            </div>
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  Strong Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {strongSkills.map((skill: string) => (
                    <SkillTag key={skill} skill={skill} variant="accent" />
                  ))}
                </div>
              </div>
              {weakSkills.length > 0 && (
                <div className="card-elevated p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-destructive" />
                    Skills to Improve
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {weakSkills.map((skill: string) => (
                      <SkillTag key={skill} skill={skill} variant="muted" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <ImprovementTips tips={tips} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Generate resume-specific tips when AI tips aren't cached
function generateTipsFromResume(resume: any) {
  const tips: any[] = [];
  const skills = resume.parsed_skills || [];
  const experience = resume.parsed_experience || [];
  const education = resume.parsed_education || [];
  const summary = resume.parsed_summary || "";
  const name = resume.parsed_name || "";
  const email = resume.parsed_email || "";
  const phone = resume.parsed_phone || "";

  // Check contact completeness
  if (!email || !phone) {
    tips.push({
      type: "warning",
      skill: "Incomplete Contact Info",
      message: `Your resume is missing ${!email ? "email" : ""}${!email && !phone ? " and " : ""}${!phone ? "phone number" : ""}. Recruiters need easy ways to reach you.`,
    });
  }

  // Check summary
  if (!summary || summary.length < 50) {
    tips.push({
      type: "suggestion",
      skill: "Add Professional Summary",
      message: "A strong 2-3 sentence summary highlighting your top skills and years of experience helps recruiters quickly understand your value proposition.",
    });
  }

  // Check skills count
  if (skills.length < 5) {
    tips.push({
      type: "warning",
      skill: "Too Few Skills Listed",
      message: `You only have ${skills.length} skills listed. Most competitive resumes include 10-15 relevant skills including both technical and soft skills.`,
    });
  } else if (skills.length >= 5 && skills.length < 10) {
    tips.push({
      type: "improvement",
      skill: "Expand Skills Section",
      message: `You have ${skills.length} skills — consider adding certifications, tools, or methodologies relevant to your target role to improve ATS matching.`,
    });
  }

  // Check experience
  if (experience.length === 0) {
    tips.push({
      type: "warning",
      skill: "No Experience Found",
      message: "Your resume doesn't show any work experience. Add internships, projects, freelance work, or volunteer experience to demonstrate your capabilities.",
    });
  } else if (experience.length < 3) {
    tips.push({
      type: "suggestion",
      skill: "Strengthen Experience Section",
      message: `You have ${experience.length} experience ${experience.length === 1 ? "entry" : "entries"}. Consider adding detailed bullet points with quantified achievements (e.g., "Increased performance by 40%").`,
    });
  }

  // Check education
  if (education.length === 0) {
    tips.push({
      type: "suggestion",
      skill: "Missing Education",
      message: "No education entries found. Add your degrees, certifications, or relevant coursework to strengthen your profile.",
    });
  }

  // Keyword optimization
  if (skills.length > 0) {
    tips.push({
      type: "improvement",
      skill: "ATS Keyword Optimization",
      message: `Your top skills include ${skills.slice(0, 3).join(", ")}. Mirror exact job posting keywords in your experience descriptions to improve ATS pass rates.`,
    });
  }

  return tips.slice(0, 5);
}

export default Dashboard;