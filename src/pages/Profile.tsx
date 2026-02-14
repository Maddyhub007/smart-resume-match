import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  User, FileText, Bookmark, Clock, MoreVertical, Trash2, Eye, Loader2, PenTool,
  Briefcase, Users, MessageSquare, Plus,
} from "lucide-react";
import Layout from "../components/layout/Layout";
import MatchScoreRing from "../components/ui/MatchScoreRing";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CandidateProfile = ({ user, profile, signOut }: any) => {
  const [activeTab, setActiveTab] = useState<"resumes" | "saved" | "applications">("resumes");
  const [resumes, setResumes] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [resumeRes, savedRes, appRes] = await Promise.all([
      supabase.from("resumes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("saved_jobs").select("*, jobs(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("job_applications").select("*, jobs(*)").eq("candidate_id", user.id).order("created_at", { ascending: false }),
    ]);
    setResumes(resumeRes.data || []);
    setSavedJobs(savedRes.data || []);
    setApplications(appRes.data || []);
    setLoading(false);
  };

  const handleDeleteResume = async (id: string) => {
    await supabase.from("resumes").delete().eq("id", id);
    setResumes((prev) => prev.filter((r) => r.id !== id));
    setOpenMenu(null);
    toast({ title: "Resume deleted" });
  };

  const handleUnsaveJob = async (savedId: string) => {
    await supabase.from("saved_jobs").delete().eq("id", savedId);
    setSavedJobs((prev) => prev.filter((s) => s.id !== savedId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-foreground">{profile?.full_name || "User"}</h1>
            <p className="text-muted-foreground">{profile?.email || user?.email}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{resumes.length} resumes</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Bookmark className="w-4 h-4" />
                <span>{savedJobs.length} saved jobs</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/resume-builder" className="btn-secondary">
              <PenTool className="w-4 h-4" /> Build Resume
            </Link>
            <Link to="/upload" className="btn-primary">Upload Resume</Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {([
          { key: "resumes" as const, icon: FileText, label: "My Resumes" },
          { key: "saved" as const, icon: Bookmark, label: "Saved Jobs" },
          { key: "applications" as const, icon: Clock, label: "Applications" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === "resumes" && resumes.map((resume) => (
          <div key={resume.id} className="card-elevated p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{resume.file_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(resume.created_at).toLocaleDateString()}
                  {resume.parsed_skills?.length > 0 && ` • ${resume.parsed_skills.length} skills detected`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <MatchScoreRing score={resume.overall_score || 0} size="sm" />
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === resume.id ? null : resume.id)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {openMenu === resume.id && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] z-10">
                      <Link to="/dashboard" className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted">
                        <Eye className="w-4 h-4" /> View Analysis
                      </Link>
                      <button
                        onClick={() => handleDeleteResume(resume.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {activeTab === "saved" && savedJobs.map((saved) => (
          <div key={saved.id} className="card-elevated p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{saved.jobs?.title}</h3>
                <p className="text-sm text-muted-foreground">{saved.jobs?.company} • {saved.jobs?.location}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleUnsaveJob(saved.id)} className="btn-secondary text-sm py-2 px-3">
                  <Bookmark className="w-4 h-4 fill-current" /> Unsave
                </button>
              </div>
            </div>
          </div>
        ))}

        {activeTab === "applications" && applications.map((app) => (
          <div key={app.id} className="card-elevated p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{app.jobs?.title}</h3>
                <p className="text-sm text-muted-foreground">{app.jobs?.company}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  app.status === "applied" ? "bg-primary/10 text-primary" :
                  app.status === "shortlisted" ? "bg-success/10 text-success" :
                  app.status === "rejected" ? "bg-destructive/10 text-destructive" :
                  "bg-accent/10 text-accent"
                }`}>
                  {app.status}
                </span>
                {app.match_score > 0 && <MatchScoreRing score={app.match_score} size="sm" />}
              </div>
            </div>
          </div>
        ))}

        {activeTab === "resumes" && resumes.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No resumes uploaded yet.</p>
            <Link to="/upload" className="btn-primary mt-4 inline-flex">Upload Resume</Link>
          </div>
        )}
        {activeTab === "saved" && savedJobs.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No saved jobs yet.</p>
            <Link to="/jobs" className="btn-primary mt-4 inline-flex">Browse Jobs</Link>
          </div>
        )}
        {activeTab === "applications" && applications.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No applications yet.</p>
            <Link to="/jobs" className="btn-primary mt-4 inline-flex">Find Jobs</Link>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <button onClick={signOut} className="text-sm text-muted-foreground hover:text-destructive transition-colors">
          Sign Out
        </button>
      </div>
    </>
  );
};

const RecruiterProfile = ({ user, profile, signOut }: any) => {
  const [activeTab, setActiveTab] = useState<"jobs" | "conversations">("jobs");
  const [jobs, setJobs] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [jobsRes, convoRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("recruiter_id", user.id).order("created_at", { ascending: false }),
      supabase.from("conversations").select("*, messages(content, created_at)").eq("recruiter_id", user.id).order("last_message_at", { ascending: false }),
    ]);
    const jobsData = jobsRes.data || [];
    setJobs(jobsData);
    setConversations(convoRes.data || []);

    // Fetch applicant counts per job
    if (jobsData.length > 0) {
      const counts: Record<string, number> = {};
      const { data: apps } = await supabase
        .from("job_applications")
        .select("job_id")
        .in("job_id", jobsData.map((j: any) => j.id));
      (apps || []).forEach((a: any) => {
        counts[a.job_id] = (counts[a.job_id] || 0) + 1;
      });
      setApplicantCounts(counts);
    }
    setLoading(false);
  };

  const handleDeleteJob = async (id: string) => {
    await supabase.from("jobs").update({ is_active: false }).eq("id", id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    toast({ title: "Job deactivated" });
  };

  const totalApplicants = Object.values(applicantCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-foreground">{profile?.full_name || "Recruiter"}</h1>
            <p className="text-muted-foreground">{profile?.email || user?.email}</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                <span>{jobs.length} active jobs</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{totalApplicants} applicants</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>{conversations.length} conversations</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/messages" className="btn-secondary">
              <MessageSquare className="w-4 h-4" /> Messages
            </Link>
            <Link to="/recruiter/post-job" className="btn-primary">
              <Plus className="w-4 h-4" /> Post Job
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {([
          { key: "jobs" as const, icon: Briefcase, label: "My Job Listings" },
          { key: "conversations" as const, icon: MessageSquare, label: "Conversations" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === "jobs" && jobs.map((job) => (
          <div key={job.id} className="card-elevated p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{job.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {job.company} • {job.location || "Remote"} • {job.job_type}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {applicantCounts[job.id] || 0} applicants • Posted {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/recruiter/applicants/${job.id}`} className="btn-secondary text-sm py-2 px-3">
                  <Users className="w-4 h-4" /> View Applicants
                </Link>
                <button
                  onClick={() => handleDeleteJob(job.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {activeTab === "conversations" && conversations.map((convo) => (
          <Link key={convo.id} to={`/chat/${convo.id}`} className="card-elevated p-6 block hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Conversation</p>
                <p className="text-sm text-muted-foreground truncate">
                  {convo.messages?.[0]?.content || "No messages yet"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {convo.last_message_at ? new Date(convo.last_message_at).toLocaleDateString() : ""}
              </span>
            </div>
          </Link>
        ))}

        {activeTab === "jobs" && jobs.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No jobs posted yet.</p>
            <Link to="/recruiter/post-job" className="btn-primary mt-4 inline-flex">Post Your First Job</Link>
          </div>
        )}
        {activeTab === "conversations" && conversations.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No conversations yet. Message applicants from the applicants page.</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <button onClick={signOut} className="text-sm text-muted-foreground hover:text-destructive transition-colors">
          Sign Out
        </button>
      </div>
    </>
  );
};

const Profile = () => {
  const { user, profile, signOut, role } = useAuth();

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {role === "recruiter" ? (
            <RecruiterProfile user={user} profile={profile} signOut={signOut} />
          ) : (
            <CandidateProfile user={user} profile={profile} signOut={signOut} />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
