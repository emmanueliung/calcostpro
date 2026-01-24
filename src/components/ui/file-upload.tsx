
"use client";

import { useCallback } from 'react';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from './button';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  currentFile: File | null;
}

export function FileUpload({ onFileSelect, currentFile }: FileUploadProps) {
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.gif', '.svg', '.webp'] },
    multiple: false,
  });
  
  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  }

  return (
    <div>
      {currentFile ? (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className='flex items-center gap-3'>
                <FileIcon className="h-6 w-6 text-primary" />
                <div className='flex flex-col'>
                    <span className="font-medium">{currentFile.name}</span>
                    <span className='text-xs text-muted-foreground'>{(currentFile.size / 1024).toFixed(2)} KB</span>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={removeFile} className='text-muted-foreground hover:text-destructive'>
                <X className="h-4 w-4" />
            </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-center text-muted-foreground">
            {isDragActive ? 'Suelta el archivo aquí...' : "Arrastra y suelta tu archivo aquí, o haz clic para seleccionar"}
          </p>
           <p className="text-xs text-muted-foreground mt-2">PNG, JPG, GIF, WEBP hasta 5MB</p>
        </div>
      )}
    </div>
  );
}
