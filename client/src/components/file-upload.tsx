import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number;
  title?: string;
  description?: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function FileUpload({ 
  onUpload, 
  accept = ".xlsx,.xls,.csv",
  maxSize = 10 * 1024 * 1024,
  title = "Upload Data File",
  description = "Drag and drop your Excel or CSV file here"
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, []);

  const handleFile = async (file: File) => {
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    setFile(file);
    setStatus("uploading");
    setProgress(0);
    setError(null);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onUpload(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
  };

  return (
    <Card data-testid="file-upload">
      <CardContent className="p-6">
        <div 
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            status === "success" && "border-green-500/50 bg-green-500/5",
            status === "error" && "border-red-500/50 bg-red-500/5"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {status === "idle" && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
              <input
                type="file"
                accept={accept}
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="file-input"
              />
              <Button variant="outline" size="sm" className="pointer-events-none">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Supported: {accept.replace(/\./g, "").toUpperCase().replace(/,/g, ", ")}
              </p>
            </>
          )}

          {(status === "uploading" || status === "success") && file && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              
              <Progress value={progress} className="h-2" />
              
              <div className="flex items-center justify-center gap-2">
                {status === "uploading" && (
                  <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
                )}
                {status === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-500">Upload complete!</p>
                  </>
                )}
              </div>

              {status === "success" && (
                <Button variant="outline" size="sm" onClick={reset}>
                  Upload Another
                </Button>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={reset}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
