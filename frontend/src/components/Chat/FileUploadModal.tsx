import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, File, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (documentId: string, filename: string) => void;
  conversationId: string;
}

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
}

export function FileUploadModal({ isOpen, onClose, onUploadComplete, conversationId }: FileUploadModalProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }));
    setFiles(prev => [...prev, ...newFiles]);
    
    // Automatically trigger upload after files are added
    setTimeout(() => {
      setIsUploading(true);
    }, 100);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const uploadFile = async (fileIndex: number) => {
    const uploadedFile = files[fileIndex];
    if (!uploadedFile) return;

    const formData = new FormData();
    formData.append('file', uploadedFile.file);
    formData.append('conversationId', conversationId);

    try {
      // Update status to uploading
      setFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, status: 'uploading' as const } : f
      ));

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');

      const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          
          setFiles(prev => prev.map((f, i) => 
            i === fileIndex ? { ...f, progress } : f
          ));
        }
      });

      // Update status to success
      setFiles(prev => prev.map((f, i) => 
        i === fileIndex 
          ? { 
              ...f, 
              status: 'success' as const, 
              progress: 100,
              documentId: response.data.document.id 
            } 
          : f
      ));

      // Notify parent immediately after successful upload
      onUploadComplete(response.data.document.id, uploadedFile.file.name);
      
      console.log('✅ Document uploaded successfully:', response.data.document.id, uploadedFile.file.name);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Upload failed';

      setFiles(prev => prev.map((f, i) => 
        i === fileIndex 
          ? { ...f, status: 'error' as const, error: errorMessage } 
          : f
      ));
    }
  };



  const handleUploadAll = async () => {
    setIsUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await uploadFile(i);
      }
    }
    
    setIsUploading(false);
  };

  // Auto-upload when files are added
  useEffect(() => {
    if (isUploading && files.some(f => f.status === 'pending')) {
      handleUploadAll();
    }
  }, [isUploading]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Upload Documents
          </h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supports PDF and images (JPG, PNG, GIF, BMP) up to 10MB
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              {files.map((uploadedFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg"
                >
                  <File className="text-gray-400 flex-shrink-0" size={20} />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    
                    {/* Progress bar */}
                    {uploadedFile.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    )}
                    
                    {/* Error message */}
                    {uploadedFile.status === 'error' && uploadedFile.error && (
                      <p className="mt-1 text-xs text-red-500">{uploadedFile.error}</p>
                    )}
                  </div>

                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {uploadedFile.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                    {uploadedFile.status === 'uploading' && (
                      <Loader className="text-blue-500 animate-spin" size={20} />
                    )}
                    {uploadedFile.status === 'success' && (
                      <CheckCircle className="text-green-500" size={20} />
                    )}
                    {uploadedFile.status === 'error' && (
                      <AlertCircle className="text-red-500" size={20} />
                    )}
                  </div>

                  {/* Remove button */}
                  {uploadedFile.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {files.filter(f => f.status === 'success').length} of {files.length} uploaded
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isUploading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadAll}
                disabled={isUploading || files.every(f => f.status !== 'pending')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
