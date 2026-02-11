import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import FileUploadZone from "../components/upload/FileUploadZone";
import ParsedResumePreview from "../components/upload/ParsedResumePreview";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Upload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
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
      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 15, 90));
      }, 200);

      // Upload to Supabase storage
      const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, selectedFile);

      clearInterval(interval);

      if (uploadError) throw uploadError;
      setUploadProgress(100);

      // Create resume record
      const { data: resumeData, error: insertError } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          file_name: selectedFile.name,
          file_url: filePath,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setResumeId(resumeData.id);
      setIsUploading(false);
      setIsParsing(true);

      // Call parse-resume edge function
      const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-resume", {
        body: { resumeId: resumeData.id, fileName: filePath },
      });

      if (parseError) throw parseError;

      setParsedResume(parseData.parsed);
      setIsParsing(false);
      toast({ title: "Resume parsed successfully!" });
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
  };

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h1 className="section-title mb-4">Upload Your Resume</h1>
            <p className="section-subtitle mx-auto">
              Upload your resume and our AI will extract your skills, experience, and
              qualifications to find the best job matches.
            </p>
          </div>

          {!parsedResume && (
            <FileUploadZone
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              uploadedFile={file}
              onRemoveFile={handleRemoveFile}
            />
          )}

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
              <div className="flex items-center justify-center gap-3 py-6">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-muted-foreground font-medium">AI is analyzing your resume...</span>
              </div>
            </div>
          )}

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
