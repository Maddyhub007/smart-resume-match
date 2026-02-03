import { useState } from "react";
import { Briefcase } from "lucide-react";
import Layout from "../components/layout/Layout";
import JobCard from "../components/ui/JobCard";
import JobFilters from "../components/filters/JobFilters";

// Mock job data
const mockJobs = [
  {
    id: "1",
    title: "Senior Frontend Developer",
    company: "TechCorp Inc.",
    location: "San Francisco, CA",
    matchScore: 92,
    skills: ["React", "TypeScript", "GraphQL", "Node.js", "AWS"],
    experience: "5+ years",
    saved: false,
  },
  {
    id: "2",
    title: "Full Stack Engineer",
    company: "StartupXYZ",
    location: "Remote",
    matchScore: 87,
    skills: ["React", "Python", "PostgreSQL", "Docker"],
    experience: "3-5 years",
    saved: true,
  },
  {
    id: "3",
    title: "React Developer",
    company: "DigitalAgency",
    location: "New York, NY",
    matchScore: 85,
    skills: ["React", "JavaScript", "CSS", "Figma"],
    experience: "2-4 years",
    saved: false,
  },
  {
    id: "4",
    title: "Software Engineer II",
    company: "BigTech Corp",
    location: "Seattle, WA",
    matchScore: 79,
    skills: ["React", "TypeScript", "AWS", "Microservices"],
    experience: "4+ years",
    saved: false,
  },
  {
    id: "5",
    title: "Frontend Team Lead",
    company: "InnovateTech",
    location: "Austin, TX",
    matchScore: 74,
    skills: ["React", "Vue.js", "Team Leadership", "Agile"],
    experience: "6+ years",
    saved: false,
  },
  {
    id: "6",
    title: "UI Engineer",
    company: "DesignFirst",
    location: "Remote",
    matchScore: 71,
    skills: ["React", "CSS", "Animation", "Accessibility"],
    experience: "3+ years",
    saved: true,
  },
];

const Jobs = () => {
  const [jobs, setJobs] = useState(mockJobs);
  const [filters, setFilters] = useState({
    matchScore: "",
    location: "",
    experience: "",
  });

  const handleSave = (jobId: string) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, saved: !job.saved } : job))
    );
  };

  const handleApply = (jobId: string) => {
    // In real app, this would open application flow
    console.log("Applying to job:", jobId);
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  // Filter jobs based on selected filters
  const filteredJobs = jobs.filter((job) => {
    if (filters.matchScore && job.matchScore < parseInt(filters.matchScore)) {
      return false;
    }
    if (filters.location) {
      const locationMap: Record<string, string> = {
        remote: "Remote",
        "san-francisco": "San Francisco",
        "new-york": "New York",
        seattle: "Seattle",
        austin: "Austin",
      };
      if (!job.location.toLowerCase().includes(locationMap[filters.location]?.toLowerCase() || "")) {
        return false;
      }
    }
    return true;
  });

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="section-title mb-2 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-primary" />
              Job Recommendations
            </h1>
            <p className="text-muted-foreground">
              {filteredJobs.length} jobs match your profile • Sorted by match score
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <JobFilters filters={filters} onFilterChange={handleFilterChange} />
          </div>

          {/* Job List */}
          <div className="space-y-4">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job, index) => (
                <div
                  key={job.id}
                  className="opacity-0 animate-fade-in-up"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  <JobCard job={job} onSave={handleSave} onApply={handleApply} />
                </div>
              ))
            ) : (
              <div className="card-elevated p-12 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No jobs found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters to see more results.
                </p>
              </div>
            )}
          </div>

          {/* Load More */}
          {filteredJobs.length > 0 && (
            <div className="text-center mt-8">
              <button className="btn-secondary">Load More Jobs</button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Jobs;
