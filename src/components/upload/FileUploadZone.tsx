import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2, CloudUpload } from "lucide-react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadedFile?: File | null;
  onRemoveFile?: () => void;
}

const FileUploadZone = ({
  onFileSelect,
  isUploading = false,
  uploadProgress = 0,
  uploadedFile,
  onRemoveFile,
}: FileUploadZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "application/pdf" || file.name.endsWith(".docx"))) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  if (uploadedFile && !isUploading) {
    return (
      <div className="card-elevated p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{uploadedFile.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to parse
          </p>
        </div>
        <button
          onClick={onRemoveFile}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
          title="Remove file"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : isUploading
          ? "border-primary/40 bg-primary/3"
          : "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
      }`}
    >
      {!isUploading && (
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      )}

      <div className="flex flex-col items-center gap-5">
        {isUploading ? (
          <>
            <div className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center shadow-lg">
              <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
            </div>
            <div className="w-full max-w-sm">
              <p className="font-semibold text-foreground mb-1">Uploading resume...</p>
              <p className="text-sm text-muted-foreground mb-3">Please wait while we process your file</p>
              <div className="progress-bar h-2.5">
                <div
                  className="progress-fill transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-primary font-medium mt-2">{uploadProgress}%</p>
            </div>
          </>
        ) : (
          <>
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                isDragOver ? "gradient-primary shadow-lg scale-110" : "bg-primary/10"
              }`}
            >
              {isDragOver ? (
                <FileText className="w-10 h-10 text-primary-foreground" />
              ) : (
                <CloudUpload className="w-10 h-10 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground mb-1">
                {isDragOver ? "Drop your resume here" : "Upload Your Resume"}
              </p>
              <p className="text-muted-foreground">
                Drag & drop or{" "}
                <span className="text-primary font-semibold">click to browse</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
                <FileText className="w-3.5 h-3.5" /> PDF
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
                <FileText className="w-3.5 h-3.5" /> DOCX
              </span>
              <span className="px-3 py-1.5 rounded-full bg-muted border border-border">Max 10MB</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploadZone;
