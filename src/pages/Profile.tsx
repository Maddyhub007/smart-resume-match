import { useState } from "react";
import { Link } from "react-router-dom";
import {
  User,
  FileText,
  Bookmark,
  Clock,
  MoreVertical,
  Trash2,
  Eye,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import Layout from "../components/layout/Layout";
import MatchScoreRing from "../components/ui/MatchScoreRing";

// Mock data
const mockResumes = [
  {
    id: "1",
    filename: "Sarah_Johnson_Resume_2024.pdf",
    uploadedAt: "2024-01-15",
    matchScore: 78,
    jobsMatched: 24,
  },
  {
    id: "2",
    filename: "Sarah_Johnson_Resume_Frontend.pdf",
    uploadedAt: "2024-01-10",
    matchScore: 72,
    jobsMatched: 18,
  },
];

const mockSavedJobs = [
  {
    id: "1",
    title: "Senior Frontend Developer",
    company: "TechCorp Inc.",
    matchScore: 92,
    savedAt: "2024-01-15",
  },
  {
    id: "2",
    title: "Full Stack Engineer",
    company: "StartupXYZ",
    matchScore: 87,
    savedAt: "2024-01-14",
  },
  {
    id: "3",
    title: "React Developer",
    company: "DigitalAgency",
    matchScore: 85,
    savedAt: "2024-01-13",
  },
];

const mockHistory = [
  {
    id: "1",
    action: "Resume analyzed",
    details: "Sarah_Johnson_Resume_2024.pdf",
    timestamp: "2024-01-15 14:30",
  },
  {
    id: "2",
    action: "Job saved",
    details: "Senior Frontend Developer at TechCorp Inc.",
    timestamp: "2024-01-15 14:25",
  },
  {
    id: "3",
    action: "Resume analyzed",
    details: "Sarah_Johnson_Resume_Frontend.pdf",
    timestamp: "2024-01-10 10:15",
  },
];

const Profile = () => {
  const [activeTab, setActiveTab] = useState<"resumes" | "saved" | "history">("resumes");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Profile Header */}
          <div className="card-elevated p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center">
                <User className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-foreground">Sarah Johnson</h1>
                <p className="text-muted-foreground">sarah.johnson@email.com</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>{mockResumes.length} resumes uploaded</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Bookmark className="w-4 h-4" />
                    <span>{mockSavedJobs.length} jobs saved</span>
                  </div>
                </div>
              </div>
              <Link to="/upload" className="btn-primary">
                Upload New Resume
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab("resumes")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "resumes"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                My Resumes
              </div>
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Saved Jobs
              </div>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
                activeTab === "history"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                History
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* Resumes Tab */}
            {activeTab === "resumes" && (
              <>
                {mockResumes.map((resume) => (
                  <div key={resume.id} className="card-elevated p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {resume.filename}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Uploaded on {resume.uploadedAt} • {resume.jobsMatched} job matches
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <MatchScoreRing score={resume.matchScore} size="sm" />

                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenMenu(openMenu === resume.id ? null : resume.id)
                            }
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {openMenu === resume.id && (
                            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] z-10">
                              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted">
                                <Eye className="w-4 h-4" />
                                View Details
                              </button>
                              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted">
                                <RefreshCw className="w-4 h-4" />
                                Re-analyze
                              </button>
                              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted">
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Saved Jobs Tab */}
            {activeTab === "saved" && (
              <>
                {mockSavedJobs.map((job) => (
                  <div key={job.id} className="card-elevated p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {job.company} • Saved on {job.savedAt}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <MatchScoreRing score={job.matchScore} size="sm" />
                        <button className="btn-primary text-sm py-2 px-4">
                          View Job
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="card-elevated p-6">
                <div className="space-y-4">
                  {mockHistory.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-4 pb-4 ${
                        index !== mockHistory.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{item.action}</p>
                        <p className="text-sm text-muted-foreground truncate">{item.details}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
