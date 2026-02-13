import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Users, MessageSquare, Plus, TrendingUp, Loader2, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const RecruiterDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ jobs: 0, applications: 0, shortlisted: 0, conversations: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [recentApplicants, setRecentApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("recruiter_id", user!.id)
      .order("created_at", { ascending: false });

    const jobList = jobs || [];
    setRecentJobs(jobList.slice(0, 5));

    // Fetch all applications for recruiter's jobs
    const jobIds = jobList.map((j) => j.id);
    let allApps: any[] = [];
    let shortlistedCount = 0;

    if (jobIds.length > 0) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("*, resumes(parsed_skills, overall_score, file_name, parsed_name)")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      allApps = apps || [];
      shortlistedCount = allApps.filter((a) => a.status === "shortlisted" || a.status === "hired").length;

      // Enrich with candidate profiles and job info
      const enriched = await Promise.all(
        allApps.slice(0, 8).map(async (app) => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, email, location")
            .eq("user_id", app.candidate_id)
            .single();
          const job = jobList.find((j) => j.id === app.job_id);
          return { ...app, candidateProfile: prof, jobTitle: job?.title, jobCompany: job?.company };
        })
      );
      setRecentApplicants(enriched);
    }

    // Conversations count
    const { count: convCount } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("recruiter_id", user!.id);

    setStats({
      jobs: jobList.length,
      applications: allApps.length,
      shortlisted: shortlistedCount,
      conversations: convCount || 0,
    });

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "shortlisted": return "bg-success/10 text-success";
      case "interview": return "bg-accent/10 text-accent";
      case "hired": return "bg-primary/10 text-primary";
      case "rejected": return "bg-destructive/10 text-destructive";
      case "reviewing": return "bg-warning/10 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Recruiter Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || "Recruiter"}. Manage your hiring pipeline.</p>
            </div>
            <Link to="/recruiter/post-job" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-5 h-5" /> Post New Job
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Active Jobs", value: stats.jobs, icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
              { label: "Total Applicants", value: stats.applications, icon: Users, color: "text-accent", bg: "bg-accent/10" },
              { label: "Shortlisted", value: stats.shortlisted, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
              { label: "Conversations", value: stats.conversations, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
            ].map((stat) => (
              <div key={stat.label} className="card-elevated p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Job Postings */}
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Your Job Postings</h3>
                <Link to="/recruiter/post-job" className="text-sm text-primary hover:underline">+ New Job</Link>
              </div>
              {recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No jobs posted yet.</p>
                  <Link to="/recruiter/post-job" className="btn-primary mt-3 inline-flex text-sm py-2 px-4">Post Your First Job</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentJobs.map((job) => {
                    const appCount = recentApplicants.filter((a) => a.job_id === job.id).length;
                    return (
                      <Link
                        key={job.id}
                        to={`/recruiter/applicants/${job.id}`}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.company} • {job.location || "Remote"}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{appCount} applicant(s)</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            {job.is_active ? "Active" : "Closed"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Applicants */}
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Recent Applicants</h3>
                <Link to="/messages" className="text-sm text-primary hover:underline">Messages</Link>
              </div>
              {recentApplicants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No applicants yet. Post a job to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentApplicants.slice(0, 6).map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/recruiter/applicants/${app.job_id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(app.candidateProfile?.full_name || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {app.candidateProfile?.full_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Applied for {app.jobTitle}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <Link to="/recruiter/post-job" className="card-elevated p-5 hover:border-primary/30 transition-all text-center group">
              <Plus className="w-8 h-8 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-medium text-foreground text-sm">Post New Job</p>
              <p className="text-xs text-muted-foreground mt-1">Create a new listing</p>
            </Link>
            <Link to="/messages" className="card-elevated p-5 hover:border-primary/30 transition-all text-center group">
              <MessageSquare className="w-8 h-8 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-medium text-foreground text-sm">Messages</p>
              <p className="text-xs text-muted-foreground mt-1">Chat with candidates</p>
            </Link>
            <Link to="/profile" className="card-elevated p-5 hover:border-primary/30 transition-all text-center group">
              <Eye className="w-8 h-8 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-medium text-foreground text-sm">Your Profile</p>
              <p className="text-xs text-muted-foreground mt-1">Update your details</p>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RecruiterDashboard;
