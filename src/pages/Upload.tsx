import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import FileUploadZone from "../components/upload/FileUploadZone";
import ParsedResumePreview from "../components/upload/ParsedResumePreview";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PARSE_STEPS = [
  "Reading document structure...",
  "Extracting text content...",
  "Analysing with AI...",
  "Building your profile...",
];

const Upload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStep, setParseStep] = useState(0);
  const [parsedResume, setParsedResume] = useState<any>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    if (!user) {
      toast({ title: "Please sign in first", variant: "destructive" });
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate smooth upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 12, 90));
      }, 180);

      const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, selectedFile);

      clearInterval(interval);
      if (uploadError) throw uploadError;
      setUploadProgress(100);

      const { data: resumeData, error: insertError } = await supabase
        .from("resumes")
        .insert({ user_id: user.id, file_name: selectedFile.name, file_url: filePath })
        .select()
        .single();

      if (insertError) throw insertError;
      setResumeId(resumeData.id);
      setIsUploading(false);
      setIsParsing(true);
      setParseStep(0);

      // Cycle through parse steps for UX
      const stepInterval = setInterval(() => {
        setParseStep((prev) => Math.min(prev + 1, PARSE_STEPS.length - 1));
      }, 2500);

      const { data: parseData, error: parseError } = await supabase.functions.invoke(
        "parse-resume",
        { body: { resumeId: resumeData.id, fileName: filePath } }
      );

      clearInterval(stepInterval);

      if (parseError) throw parseError;
      if (parseData?.error) throw new Error(parseData.error);

      setParsedResume(parseData.parsed);
      setIsParsing(false);
      toast({ title: "Resume analysed successfully! 🎉" });
    } catch (error: any) {
      console.error("Upload error:", error);
      setIsUploading(false);
      setIsParsing(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedResume(null);
    setUploadProgress(0);
    setResumeId(null);
    setParseStep(0);
  };

  return (
    <Layout>
      <div className="py-14 px-4">
        <div className="container mx-auto max-w-4xl">

          {/* ── Page header ── */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
              <Sparkles className="w-4 h-4" />
              AI-Powered Resume Analysis
            </div>
            <h1 className="section-title mb-4">Upload Your Resume</h1>
            <p className="section-subtitle mx-auto">
              Our AI extracts your skills, experience, and qualifications to find the best job
              matches for you.
            </p>
          </div>

          {/* ── Progress steps (top of page) ── */}
          {!parsedResume && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {["Upload", "Parse", "Match"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      i === 0
                        ? "gradient-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-white/20" : "bg-border"
                      }`}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </div>
                  {i < 2 && <div className="w-6 h-px bg-border" />}
                </div>
              ))}
            </div>
          )}

          {/* ── Upload zone ── */}
          {!parsedResume && (
            <FileUploadZone
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              uploadedFile={file}
              onRemoveFile={handleRemoveFile}
            />
          )}

          {/* ── Parsing skeleton / progress ── */}
          {isParsing && (
            <div className="mt-6 space-y-5">
              {/* Animated parsing card */}
              <div className="card-elevated p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-primary shadow-lg mb-5">
                  <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  AI is analysing your resume
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {PARSE_STEPS[parseStep]}
                </p>
                {/* step dots */}
                <div className="flex items-center justify-center gap-2">
                  {PARSE_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        i <= parseStep
                          ? "w-6 gradient-primary"
                          : "w-2 bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* skeleton preview */}
              <div className="card-elevated p-6 animate-pulse">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-muted rounded w-2/5" />
                    <div className="h-3.5 bg-muted rounded w-1/2" />
                    <div className="h-3.5 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </div>
              <div className="card-elevated p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-4" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-7 bg-muted rounded-full" style={{ width: `${60 + i * 15}px` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Parsed result ── */}
          {parsedResume && !isParsing && (
            <div className="space-y-6">
              {/* Success banner */}
              <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">
                  Resume analysed successfully! Review the details below and continue.
                </p>
              </div>

              <ParsedResumePreview resume={parsedResume} />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button onClick={handleRemoveFile} className="btn-secondary w-full sm:w-auto">
                  Upload Different Resume
                </button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn-primary w-full sm:w-auto"
                >
                  Continue to Dashboard
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
