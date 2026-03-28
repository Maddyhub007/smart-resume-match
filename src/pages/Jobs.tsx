import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2, Globe, Building2, Search, ChevronLeft, ChevronRight, Sparkles, FileText, X, Filter } from "lucide-react";
import Layout from "../components/layout/Layout";
import JobCard from "../components/ui/JobCard";
import ExternalJobCard from "../components/ui/ExternalJobCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type TabType = "all" | "internal" | "external";
type JobTypeFilter = "" | "remote" | "onsite" | "hybrid" | "full_time" | "part_time" | "contract";

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

interface UnifiedFilters {
  keyword: string;
  location: string;
  experience: string;
  jobType: JobTypeFilter;
  minMatchScore: string;
}

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Unified filters
  const [filters, setFilters] = useState<UnifiedFilters>({
    keyword: "",
    location: "",
    experience: "",
    jobType: "",
    minMatchScore: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // External jobs state
  const [externalJobs, setExternalJobs] = useState<ExternalJob[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalPage, setExternalPage] = useState(1);
  const [externalPagination, setExternalPagination] = useState({ total: 0, totalPages: 1 });
  const [hasSearched, setHasSearched] = useState(false);

  // Resume selection dialog
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyingJob, setApplyingJob] = useState<any>(null);
  const [userResumes, setUserResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  // Internal jobs
  useEffect(() => {
    fetchJobs();
    if (user) {
      fetchSavedJobs();
      fetchUserResumes();
    }

    const jobsChannel = supabase
      .channel("jobs-live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => fetchJobs())
      .subscribe();

    return () => { supabase.removeChannel(jobsChannel); };
  }, [user]);

  // Auto-fetch external when switching to all/external tab
  useEffect(() => {
    if ((activeTab === "all" || activeTab === "external") && !hasSearched) {
      fetchExternalJobs(1);
    }
  }, [activeTab]);

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
          return { ...job, matchScore: Math.max(matchScore, 10), _type: "internal" as const };
        });
        jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);
        setJobs(jobsWithScores);
      } else {
        setJobs(data.map((j) => ({ ...j, matchScore: 50, _type: "internal" as const })));
      }
    }
    setLoading(false);
  };

  const fetchSavedJobs = async () => {
    const { data } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user!.id);
    if (data) setSavedJobIds(new Set(data.map((s) => s.job_id)));
  };

  const fetchUserResumes = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_resumes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    setUserResumes(data || []);
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
    const job = jobs.find((j) => j.id === jobId);
    setApplyingJobId(jobId);
    setApplyingJob(job);
    setSelectedResumeId(null);
    setShowResumeDialog(true);
  };

  const confirmApply = async () => {
    if (!user || !applyingJobId) return;
    
    // Get the parsed resume id if available
    const { data: resume } = await supabase.from("resumes").select("id")
      .eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    
    const job = jobs.find((j) => j.id === applyingJobId);
    const { error } = await supabase.from("job_applications").insert({
      job_id: applyingJobId,
      candidate_id: user.id,
      resume_id: resume?.id || null,
      match_score: job?.matchScore || 0,
    });
    
    if (error) {
      toast({
        title: error.code === "23505" ? "Already applied to this job" : "Error",
        description: error.code !== "23505" ? error.message : undefined,
        variant: error.code === "23505" ? "default" : "destructive",
      });
    } else {
      toast({ title: "Application submitted! ✅" });
    }
    setShowResumeDialog(false);
    setApplyingJobId(null);
    setApplyingJob(null);
  };

  const handleOptimizeForJob = (job: any) => {
    navigate("/resume-builder", {
      state: {
        optimizeForJob: {
          title: job.title,
          description: job.description || "",
          skills: job.skills_required || job.skills || [],
        },
      },
    });
  };

  // Calculate match score for external jobs
  const calculateExternalMatchScores = (externalJobs: ExternalJob[], candidateSkills: string[]): ExternalJob[] => {
    if (candidateSkills.length === 0) return externalJobs;
    return externalJobs.map((job) => {
      const jobSkills = job.skills.map((s) => s.toLowerCase());
      const jobText = `${job.title} ${job.description}`.toLowerCase();
      if (jobSkills.length === 0) {
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
      let candidateSkills: string[] = [];
      if (user) {
        const { data: resume } = await supabase
          .from("resumes").select("parsed_skills").eq("user_id", user.id).eq("is_active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        candidateSkills = (resume?.parsed_skills || []).map((s: string) => s.toLowerCase());
      }

      const { data, error } = await supabase.functions.invoke("fetch-external-jobs", {
        body: {
          keyword: filters.keyword || undefined,
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
  }, [filters.keyword, filters.location, filters.experience, user]);

  // Apply filters to internal jobs
  const filteredInternalJobs = jobs.filter((job) => {
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      const searchable = `${job.title} ${job.company} ${(job.skills_required || []).join(" ")} ${job.description || ""}`.toLowerCase();
      if (!searchable.includes(kw)) return false;
    }
    if (filters.minMatchScore && job.matchScore < parseInt(filters.minMatchScore)) return false;
    if (filters.location) {
      if (!job.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
    }
    if (filters.experience) {
      const expMap: Record<string, string[]> = { internship: ["intern", "internship"], entry: ["entry", "junior", "fresher"], mid: ["mid", "intermediate"], senior: ["senior", "lead", "principal"] };
      const jobExp = (job.experience_level || "").toLowerCase();
      const allowed = expMap[filters.experience] || [];
      if (!allowed.some((kw) => jobExp.includes(kw))) return false;
    }
    if (filters.jobType) {
      const jt = (job.job_type || "").toLowerCase();
      if (filters.jobType === "remote" && !jt.includes("remote") && !job.location?.toLowerCase().includes("remote")) return false;
      if (filters.jobType === "onsite" && (jt.includes("remote") || job.location?.toLowerCase().includes("remote"))) return false;
    }
    return true;
  });

  // Apply filters to external jobs  
  const filteredExternalJobs = externalJobs.filter((job) => {
    if (filters.minMatchScore && (job.matchScore || 0) < parseInt(filters.minMatchScore)) return false;
    if (filters.jobType) {
      const jt = (job.jobType || "").toLowerCase();
      const loc = job.location.toLowerCase();
      if (filters.jobType === "remote" && !jt.includes("remote") && !loc.includes("remote")) return false;
      if (filters.jobType === "onsite" && (jt.includes("remote") || loc.includes("remote"))) return false;
    }
    return true;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExternalJobs(1);
    // Internal jobs are filtered client-side
  };

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
              Browse internal & external opportunities matched to your profile
            </p>
          </div>

          {/* Unified Search Bar */}
          <div className="card-elevated p-4 mb-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={filters.keyword}
                  onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                  placeholder="Search by keyword, role, or company..."
                  className="input-field pl-10 w-full"
                />
              </div>
              <button type="submit" className="btn-primary py-2.5 px-6 flex items-center gap-2 justify-center">
                <Search className="w-4 h-4" /> Search
              </button>
              <button type="button" onClick={() => setShowFilters(!showFilters)} className="btn-secondary py-2.5 px-4 flex items-center gap-2 justify-center">
                <Filter className="w-4 h-4" /> Filters
              </button>
            </form>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                  <input
                    value={filters.location}
                    onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Remote, NYC..."
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Experience</label>
                  <select
                    value={filters.experience}
                    onChange={(e) => setFilters((f) => ({ ...f, experience: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="">All Levels</option>
                    <option value="internship">Internship</option>
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Job Type</label>
                  <select
                    value={filters.jobType}
                    onChange={(e) => setFilters((f) => ({ ...f, jobType: e.target.value as JobTypeFilter }))}
                    className="input-field w-full"
                  >
                    <option value="">All Types</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Match %</label>
                  <select
                    value={filters.minMatchScore}
                    onChange={(e) => setFilters((f) => ({ ...f, minMatchScore: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="">Any</option>
                    <option value="25">25%+</option>
                    <option value="50">50%+</option>
                    <option value="75">75%+</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
            {(["all", "internal", "external"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "all" && <Briefcase className="w-4 h-4" />}
                {tab === "internal" && <Building2 className="w-4 h-4" />}
                {tab === "external" && <Globe className="w-4 h-4" />}
                <span className="capitalize">{tab === "all" ? "All Jobs" : tab === "internal" ? "Platform Jobs" : "External Jobs"}</span>
              </button>
            ))}
          </div>

          {/* Job Listings */}
          {(loading || externalLoading) && (activeTab === "all" || (activeTab === "internal" && loading) || (activeTab === "external" && externalLoading)) ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading jobs...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Internal Jobs */}
              {(activeTab === "all" || activeTab === "internal") && filteredInternalJobs.length > 0 && (
                <>
                  {activeTab === "all" && (
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Platform Jobs ({filteredInternalJobs.length})
                    </h3>
                  )}
                  {filteredInternalJobs.map((job, i) => (
                    <div key={job.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                      <JobCard
                        job={{
                          id: job.id,
                          title: job.title,
                          company: job.company,
                          location: job.location || "Remote",
                          matchScore: job.matchScore,
                          skills: job.skills_required || [],
                          experience: job.experience_level || "Not specified",
                          saved: savedJobIds.has(job.id),
                        }}
                        onSave={handleSave}
                        onApply={handleApply}
                        onOptimize={() => handleOptimizeForJob(job)}
                      />
                    </div>
                  ))}
                </>
              )}

              {/* External Jobs */}
              {(activeTab === "all" || activeTab === "external") && filteredExternalJobs.length > 0 && (
                <>
                  {activeTab === "all" && (
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mt-8">
                      <Globe className="w-4 h-4" /> External Jobs ({filteredExternalJobs.length})
                    </h3>
                  )}
                  {activeTab === "external" && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Showing {filteredExternalJobs.length} of {externalPagination.total} results • Page {externalPage} of {externalPagination.totalPages}
                    </p>
                  )}
                  {filteredExternalJobs.map((job, i) => (
                    <div key={job.id} className="opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}>
                      <ExternalJobCard job={job} onOptimize={() => handleOptimizeForJob(job)} />
                    </div>
                  ))}
                </>
              )}

              {/* Empty state */}
              {filteredInternalJobs.length === 0 && filteredExternalJobs.length === 0 && !loading && !externalLoading && (
                <EmptyState message="No jobs found matching your filters. Try adjusting your search criteria." />
              )}

              {/* Pagination for external */}
              {(activeTab === "all" || activeTab === "external") && externalPagination.totalPages > 1 && (
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
            </div>
          )}
        </div>
      </div>

      {/* Resume Selection Dialog */}
      {showResumeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-foreground">Select Resume to Apply</h3>
              <button onClick={() => setShowResumeDialog(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which resume to submit for <span className="font-medium text-foreground">{applyingJob?.title}</span>
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {/* Default option - uploaded resume */}
              <button
                onClick={() => setSelectedResumeId("uploaded")}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selectedResumeId === "uploaded" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground">Uploaded Resume</p>
                  <p className="text-xs text-muted-foreground">Your originally uploaded resume</p>
                </div>
              </button>

              {/* User-created resumes */}
              {userResumes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResumeId(r.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    selectedResumeId === r.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.title.includes("Optimized") ? "Job-optimized" : r.title.includes("AI") ? "AI chatbot generated" : "Custom resume"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmApply}
                disabled={!selectedResumeId}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50"
              >
                Submit Application
              </button>
              <button
                onClick={() => {
                  setShowResumeDialog(false);
                  handleOptimizeForJob(applyingJob);
                }}
                className="btn-secondary py-2.5 px-4 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Optimize First
              </button>
            </div>
          </div>
        </div>
      )}
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
