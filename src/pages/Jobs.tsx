import { useEffect, useState, useCallback } from "react";
import { Briefcase, Loader2, Globe, Building2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "../components/layout/Layout";
import JobCard from "../components/ui/JobCard";
import ExternalJobCard from "../components/ui/ExternalJobCard";
import JobFilters from "../components/filters/JobFilters";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type TabType = "internal" | "external";

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

const Jobs = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("internal");
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ matchScore: "", location: "", experience: "" });

  // External jobs state
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalKeyword, setExternalKeyword] = useState("developer");
  const [externalPage, setExternalPage] = useState(1);
  const [externalPagination, setExternalPagination] = useState({ total: 0, totalPages: 1 });
  const [hasSearched, setHasSearched] = useState(false);

  // Internal jobs
  useEffect(() => {
    fetchJobs();
    if (user) fetchSavedJobs();

    const jobsChannel = supabase
      .channel("jobs-live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs())
      .subscribe();

    return () => { supabase.removeChannel(jobsChannel); };
  }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs").select("*").eq("is_active", true).order("created_at", { ascending: false });

    if (!error && data) {
      if (user) {
        const { data: resume } = await supabase
          .from("resumes").select("parsed_skills").eq("user_id", user.id).eq("is_active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();

        const candidateSkills = (resume?.parsed_skills || []).map((s: string) => s.toLowerCase());
        const jobsWithScores = data.map((job) => {
          const jobSkills = (job.skills_required || []).map((s: string) => s.toLowerCase());
          const matchCount = jobSkills.filter((s: string) => candidateSkills.includes(s)).length;
          const matchScore = jobSkills.length > 0 ? Math.round((matchCount / jobSkills.length) * 100) : 50;
          return { ...job, matchScore: Math.max(matchScore, 10) };
        });
        jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);
        setJobs(jobsWithScores);
      } else {
        setJobs(data.map((j) => ({ ...j, matchScore: 50 })));
      }
    }
    setLoading(false);
  };

  const fetchSavedJobs = async () => {
    const { data } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user!.id);
    if (data) setSavedJobIds(new Set(data.map((s) => s.job_id)));
  };

  const handleSave = async (jobId: string) => {
    if (!user) { toast({ title: "Please sign in to save jobs", variant: "destructive" }); return; }
    if (savedJobIds.has(jobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
      setSavedJobIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      setSavedJobIds((prev) => new Set(prev).add(jobId));
    }
  };

  const handleApply = async (jobId: string) => {
    if (!user) { toast({ title: "Please sign in to apply", variant: "destructive" }); return; }
    const { data: resume } = await supabase.from("resumes").select("id")
      .eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const job = jobs.find((j) => j.id === jobId);
    const { error } = await supabase.from("job_applications").insert({
      job_id: jobId, candidate_id: user.id, resume_id: resume?.id || null, match_score: job?.matchScore || 0,
    });
    if (error) {
      toast({ title: error.code === "23505" ? "Already applied to this job" : "Error", description: error.code !== "23505" ? error.message : undefined, variant: error.code === "23505" ? "default" : "destructive" });
    } else {
      toast({ title: "Application submitted!" });
    }
  };

  // Calculate match score for external jobs based on user's resume skills
  const calculateExternalMatchScores = (externalJobs: ExternalJob[], candidateSkills: string[]): ExternalJob[] => {
    if (candidateSkills.length === 0) return externalJobs;
    return externalJobs.map((job) => {
      const jobSkills = job.skills.map((s) => s.toLowerCase());
      const jobText = `${job.title} ${job.description}`.toLowerCase();
      if (jobSkills.length === 0) {
        // Fallback: match against title/description keywords
        const keywordMatches = candidateSkills.filter((s) => jobText.includes(s)).length;
        const score = Math.min(Math.round((keywordMatches / Math.max(candidateSkills.length, 1)) * 100), 100);
        return { ...job, matchScore: Math.max(score, 5) };
      }
      const matchCount = jobSkills.filter((s) => candidateSkills.includes(s) || candidateSkills.some((cs) => s.includes(cs) || cs.includes(s))).length;
      const score = Math.round((matchCount / jobSkills.length) * 100);
      return { ...job, matchScore: Math.max(score, 5) };
    });
  };

  const fetchExternalJobs = useCallback(async (page = 1) => {
    setExternalLoading(true);
    setHasSearched(true);
    try {
      // Get user's resume skills for matching
      let candidateSkills: string[] = [];
      if (user) {
        const { data: resume } = await supabase
          .from("resumes").select("parsed_skills").eq("user_id", user.id).eq("is_active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        candidateSkills = (resume?.parsed_skills || []).map((s: string) => s.toLowerCase());
      }

      const { data, error } = await supabase.functions.invoke("fetch-external-jobs", {
        body: {
          keyword: externalKeyword || undefined,
          location: filters.location || undefined,
          experience: filters.experience || undefined,
          page,
          perPage: 15,
        },
      });
      if (error) throw error;

      let fetchedJobs = data.jobs || [];
      fetchedJobs = calculateExternalMatchScores(fetchedJobs, candidateSkills);
      fetchedJobs.sort((a: ExternalJob, b: ExternalJob) => (b.matchScore || 0) - (a.matchScore || 0));

      setExternalJobs(fetchedJobs);
      setExternalPagination(data.pagination || { total: 0, totalPages: 1 });
      setExternalPage(page);
    } catch (e) {
      console.error("External jobs error:", e);
      toast({ title: "Failed to fetch external jobs", variant: "destructive" });
    }
    setExternalLoading(false);
  }, [externalKeyword, filters.location, filters.experience, user]);

  useEffect(() => {
    if (activeTab === "external" && !hasSearched) {
      fetchExternalJobs(1);
    }
  }, [activeTab]);

  const filteredJobs = jobs.filter((job) => {
    if (filters.matchScore && job.matchScore < parseInt(filters.matchScore)) return false;
    if (filters.location) {
      const locMap: Record<string, string> = { remote: "remote", "san-francisco": "san francisco", "new-york": "new york", seattle: "seattle", austin: "austin" };
      const sel = locMap[filters.location] || filters.location;
      if (!job.location?.toLowerCase().includes(sel)) return false;
    }
    if (filters.experience) {
      const expMap: Record<string, string[]> = { internship: ["intern", "internship"], entry: ["entry", "junior", "fresher"], mid: ["mid", "intermediate"], senior: ["senior", "lead", "principal"] };
      const jobExp = (job.experience_level || "").toLowerCase();
      const allowed = expMap[filters.experience] || [];
      if (!allowed.some((kw) => jobExp.includes(kw))) return false;
    }
    return true;
  });

  return (
    <Layout>
      <div className="py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <Briefcase className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              Job Recommendations
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Browse internal postings or discover external opportunities in real-time
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
            <button
              onClick={() => setActiveTab("internal")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "internal"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Internal Jobs</span>
              <span className="sm:hidden">Internal</span>
            </button>
            <button
              onClick={() => setActiveTab("external")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "external"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">External Jobs</span>
              <span className="sm:hidden">External</span>
            </button>
          </div>

          {activeTab === "internal" && (
            <>
              <div className="mb-6">
                <JobFilters filters={filters} onFilterChange={setFilters} />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.length > 0 ? filteredJobs.map((job, i) => (
                    <div key={job.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}>
                      <JobCard
                        job={{ id: job.id, title: job.title, company: job.company, location: job.location || "Remote", matchScore: job.matchScore, skills: job.skills_required || [], experience: job.experience_level || "Not specified", saved: savedJobIds.has(job.id) }}
                        onSave={handleSave}
                        onApply={handleApply}
                      />
                    </div>
                  )) : (
                    <EmptyState message={jobs.length === 0 ? "No jobs posted yet. Check back soon!" : "Try adjusting your filters."} />
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "external" && (
            <>
              {/* Search bar */}
              <div className="card-elevated p-4 mb-6">
                <form
                  onSubmit={(e) => { e.preventDefault(); fetchExternalJobs(1); }}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={externalKeyword}
                      onChange={(e) => setExternalKeyword(e.target.value)}
                      placeholder="Search by keyword (e.g. React, Python, Designer...)"
                      className="input-field pl-10 w-full"
                    />
                  </div>
                  <button type="submit" className="btn-primary py-2.5 px-6 flex items-center gap-2 justify-center">
                    <Search className="w-4 h-4" />
                    Search Jobs
                  </button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">
                  Powered by Remotive & Arbeitnow • Real-time external listings
                </p>
              </div>

              {externalLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Fetching jobs from multiple sources...</p>
                </div>
              ) : (
                <>
                  {externalJobs.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Showing {externalJobs.length} of {externalPagination.total} results • Page {externalPage} of {externalPagination.totalPages}
                    </p>
                  )}
                  <div className="space-y-4">
                    {externalJobs.length > 0 ? externalJobs.map((job, i) => (
                      <div key={job.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                        <ExternalJobCard job={job} />
                      </div>
                    )) : hasSearched ? (
                      <EmptyState message="No external jobs found. Try a different keyword." />
                    ) : null}
                  </div>

                  {/* Pagination */}
                  {externalPagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => fetchExternalJobs(externalPage - 1)}
                        disabled={externalPage <= 1}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {externalPage} / {externalPagination.totalPages}
                      </span>
                      <button
                        onClick={() => fetchExternalJobs(externalPage + 1)}
                        disabled={externalPage >= externalPagination.totalPages}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="card-elevated p-12 text-center">
    <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="font-semibold text-foreground mb-2">No jobs found</h3>
    <p className="text-muted-foreground">{message}</p>
  </div>
);

export default Jobs;
