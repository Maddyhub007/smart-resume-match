import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react";

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
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  if (uploadedFile && !isUploading) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{uploadedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={onRemoveFile}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      } ${isUploading ? "pointer-events-none" : "cursor-pointer"}`}
    >
      <input
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isUploading}
      />

      <div className="flex flex-col items-center gap-4">
        {isUploading ? (
          <>
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
            <div className="w-full max-w-xs">
              <p className="font-medium text-foreground mb-2">Uploading...</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{uploadProgress}%</p>
            </div>
          </>
        ) : (
          <>
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                isDragOver ? "gradient-primary" : "bg-muted"
              }`}
            >
              {isDragOver ? (
                <FileText className="w-8 h-8 text-primary-foreground" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">
                {isDragOver ? "Drop your resume here" : "Drag & drop your resume"}
              </p>
              <p className="text-sm text-muted-foreground">
                or <span className="text-primary font-medium">browse files</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Supports PDF and DOCX • Max 10MB</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploadZone;
