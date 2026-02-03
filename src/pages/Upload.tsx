import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import FileUploadZone from "../components/upload/FileUploadZone";
import ParsedResumePreview from "../components/upload/ParsedResumePreview";

// Mock parsed resume data
const mockParsedResume = {
  name: "Sarah Johnson",
  email: "sarah.johnson@email.com",
  phone: "+1 (555) 123-4567",
  location: "San Francisco, CA",
  summary:
    "Senior Frontend Developer with 5+ years of experience building scalable web applications. Passionate about user experience, performance optimization, and modern JavaScript frameworks.",
  skills: [
    "React",
    "TypeScript",
    "Node.js",
    "GraphQL",
    "AWS",
    "Docker",
    "CI/CD",
    "Agile",
    "Python",
    "PostgreSQL",
  ],
  experience: [
    {
      title: "Senior Frontend Developer",
      company: "TechCorp Inc.",
      duration: "2021 - Present",
    },
    {
      title: "Frontend Developer",
      company: "StartupXYZ",
      duration: "2019 - 2021",
    },
    {
      title: "Junior Developer",
      company: "WebAgency",
      duration: "2018 - 2019",
    },
  ],
  education: [
    {
      degree: "B.S. Computer Science",
      institution: "University of California, Berkeley",
      year: "2018",
    },
  ],
};

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResume, setParsedResume] = useState<typeof mockParsedResume | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    // Simulate upload completion
    setTimeout(() => {
      setIsUploading(false);
      setIsParsing(true);

      // Simulate parsing delay
      setTimeout(() => {
        setIsParsing(false);
        setParsedResume(mockParsedResume);
      }, 2000);
    }, 1500);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedResume(null);
    setUploadProgress(0);
  };

  const handleContinue = () => {
    // In real app, this would send parsed data to backend
    navigate("/dashboard");
  };

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="section-title mb-4">Upload Your Resume</h1>
            <p className="section-subtitle mx-auto">
              Upload your resume and our AI will extract your skills, experience, and
              qualifications to find the best job matches.
            </p>
          </div>

          {/* Upload Zone */}
          {!parsedResume && (
            <FileUploadZone
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              uploadedFile={file}
              onRemoveFile={handleRemoveFile}
            />
          )}

          {/* Parsing Skeleton */}
          {isParsing && (
            <div className="space-y-4 animate-pulse-soft">
              <div className="card-elevated p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
              <div className="card-elevated p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-4" />
                <div className="h-20 bg-muted rounded" />
              </div>
              <div className="card-elevated p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-4" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-8 w-20 bg-muted rounded-full" />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-muted-foreground font-medium">
                  Analyzing your resume...
                </span>
              </div>
            </div>
          )}

          {/* Parsed Resume Preview */}
          {parsedResume && !isParsing && (
            <div className="space-y-6">
              <ParsedResumePreview resume={parsedResume} />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button onClick={handleRemoveFile} className="btn-secondary w-full sm:w-auto">
                  Upload Different Resume
                </button>
                <button onClick={handleContinue} className="btn-primary w-full sm:w-auto">
                  Continue to Analysis
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Upload;
