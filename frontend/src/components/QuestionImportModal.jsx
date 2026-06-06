import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileJson, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  RefreshCw,
  Info
} from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function QuestionImportModal({ assessment, onClose, onSuccess }) {
  const toast = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.json') && !name.endsWith('.csv')) {
      setError('Invalid file type. Only JSON and CSV files are allowed.');
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(selectedFile);
    setError('');
    setPreview(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await api.post(`/admin/assessments/${assessment.id}/import-preview`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setPreview(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to parse file or fetch preview statistics.');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview || !preview.valid) return;
    
    setImporting(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/admin/assessments/${assessment.id}/import-questions`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(`${response.data.imported_count} questions imported for "${response.data.assessment_title}" successfully!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to complete question import database write.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async (type) => {
    try {
      const response = await api.get(`/admin/assessments/templates/questions.${type}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: type === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `questions_template.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Failed to download ${type.toUpperCase()} template`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl animate-fade-in">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-dark-950/20">
          <div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-purple" />
              Import Assessment Questions
            </h3>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
              Target: <span className="text-gray-300">{assessment.title}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
            disabled={importing}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-xs text-gray-300">
          
          {/* Download Templates info bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-dark-950/40 border border-white/5">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-brand-purple mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-gray-200">Prepare your question bank</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                  Use one of our pre-formatted templates to ensure structure compatibility.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => downloadTemplate('json')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-900 hover:bg-dark-850 border border-white/5 text-[10px] font-bold text-gray-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5 text-brand-purple" />
                JSON Template
              </button>
              <button
                onClick={() => downloadTemplate('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-900 hover:bg-dark-850 border border-white/5 text-[10px] font-bold text-gray-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5 text-brand-green" />
                CSV Template
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          {!file && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 bg-dark-950/10 ${
                dragActive 
                  ? 'border-brand-purple bg-brand-purple/5 neon-glow-purple' 
                  : 'border-white/5 hover:border-white/10 hover:bg-dark-950/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".json,.csv"
                onChange={handleChange}
              />
              <div className="p-4 rounded-2xl bg-dark-950 border border-white/5 shadow-inner">
                <Upload className="w-8 h-8 text-brand-purple animate-bounce" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-200 text-sm">Drag & drop files here</p>
                <p className="text-[10px] text-gray-500 mt-1">or click to browse from device (JSON or CSV)</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="leading-relaxed">
                <p className="font-bold">An error occurred</p>
                <p className="text-[10px] text-rose-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Loading Preview Spinner */}
          {loading && (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 text-brand-purple animate-spin" />
              <p className="text-gray-500 font-bold">Uploading and validating schema...</p>
            </div>
          )}

          {/* Preview Analysis and Statistics */}
          {file && preview && (
            <div className="flex flex-col gap-4 animate-fade-in">
              
              {/* File Info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-950/50 border border-white/5">
                <div className="flex items-center gap-2.5">
                  {file.name.endsWith('.json') ? (
                    <FileJson className="w-5 h-5 text-brand-purple" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-brand-green" />
                  )}
                  <div>
                    <p className="font-bold text-gray-200">{file.name}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setError('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 text-[10px] font-bold text-gray-400 hover:text-white transition-all"
                  disabled={importing}
                >
                  Clear File
                </button>
              </div>

              {/* Status Header */}
              {preview.valid ? (
                <div className="p-4 rounded-2xl bg-brand-green/10 border border-brand-green/20 text-brand-green flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">File schema validation passed!</p>
                    <p className="text-[10px] text-brand-green/85 mt-0.5 leading-relaxed">
                      All {preview.total_questions} questions verified. Click below to overwrite the current question pool.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">Validation failed</p>
                    <p className="text-[10px] text-rose-400/85 mt-0.5 leading-relaxed">
                      We found {preview.validation_errors.length} structure/syntax issues in the file. Please fix them to enable importing.
                    </p>
                  </div>
                </div>
              )}

              {/* Counts Distribution */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 border border-white/5 rounded-xl bg-dark-950/20 text-center">
                  <p className="text-[9px] text-gray-500 font-bold uppercase">Total</p>
                  <p className="text-lg font-black text-white mt-0.5">{preview.total_questions}</p>
                </div>
                <div className="p-3 border border-white/5 rounded-xl bg-dark-950/20 text-center">
                  <p className="text-[9px] text-brand-green font-bold uppercase">Easy</p>
                  <p className="text-lg font-black text-brand-green mt-0.5">{preview.easy}</p>
                </div>
                <div className="p-3 border border-white/5 rounded-xl bg-dark-950/20 text-center">
                  <p className="text-[9px] text-amber-400 font-bold uppercase">Medium</p>
                  <p className="text-lg font-black text-amber-400 mt-0.5">{preview.medium}</p>
                </div>
                <div className="p-3 border border-white/5 rounded-xl bg-dark-950/20 text-center">
                  <p className="text-[9px] text-rose-400 font-bold uppercase">Hard</p>
                  <p className="text-lg font-black text-rose-400 mt-0.5">{preview.hard}</p>
                </div>
              </div>

              {/* Validation Errors Panel */}
              {preview.validation_errors.length > 0 && (
                <div className="border border-white/5 rounded-2xl bg-dark-950/30 overflow-hidden flex flex-col">
                  <header className="px-4 py-2 border-b border-white/5 bg-dark-950/40">
                    <p className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">Error Details ({preview.validation_errors.length})</p>
                  </header>
                  <div className="p-4 max-h-48 overflow-y-auto flex flex-col gap-2 font-mono text-[10px]">
                    {preview.validation_errors.map((err, idx) => (
                      <div key={idx} className="text-rose-400 flex items-start gap-1.5">
                        <span className="text-rose-600 shrink-0">•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer actions */}
        <footer className="px-6 py-4 border-t border-white/5 shrink-0 flex gap-3 bg-dark-950/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-dark-950 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-bold transition-all"
            disabled={importing}
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleImport}
            className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              file && preview && preview.valid && !importing
                ? 'bg-brand-purple hover:bg-brand-purple/95 text-white shadow-lg shadow-brand-purple/20'
                : 'bg-dark-950/50 border border-white/5 text-gray-600 cursor-not-allowed'
            }`}
            disabled={!file || !preview || !preview.valid || importing}
          >
            {importing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Overwriting DB Pool...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Overwrite Question Pool
              </>
            )}
          </button>
        </footer>

      </div>
    </div>
  );
}
