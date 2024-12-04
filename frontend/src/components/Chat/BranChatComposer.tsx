import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Quote, Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { FileUploadModal } from './FileUploadModal';

interface BranChatComposerProps {
  onSend: (message: string) => void;
  onSearch?: (query: string) => Promise<string>;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  isSearchMode?: boolean;
  autoSend?: boolean;
  onAutoSendComplete?: () => void;
  selectedContext?: string;
  onClearContext?: () => void;
  onFocus?: () => void;
  onVoiceStart?: () => void;
  onUploadStart?: () => void;
  requireAuth?: boolean;
  onAuthRequired?: () => void;
  voiceInputEnabled?: boolean;
  conversationId?: string;
}

export function BranChatComposer({ 
  onSend, 
  onSearch,
  disabled = false, 
  placeholder = "Ask branchat",
  initialValue = "",
  isSearchMode = false,
  autoSend = false,
  onAutoSendComplete,
  selectedContext,
  onClearContext,
  onFocus,
  onVoiceStart,
  onUploadStart,
  requireAuth = false,
  onAuthRequired,
  voiceInputEnabled = false,
  conversationId
}: BranChatComposerProps) {
  const [message, setMessage] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const [voiceError, setVoiceError] = useState<string>('');
  const [shouldClearMessage, setShouldClearMessage] = useState(false);
  const [lastSentMessage, setLastSentMessage] = useState<string>('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedDocuments, setAttachedDocuments] = useState<Array<{ id: string; filename: string }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input hook - directly update message as user speaks
  const { isRecording, startRecording, stopRecording } = useVoiceInput({
    onTranscript: (text) => {
      setMessage(text);
      setVoiceError('');
      
      // Auto-adjust textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
      }
    },
    onError: (error) => {
      setVoiceError(error);
      setTimeout(() => setVoiceError(''), 3000);
    }
  });

  // Handle microphone click - toggle recording
  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    // Don't set message if we just cleared it
    if (shouldClearMessage) {
      return;
    }
    
    if (initialValue) {
      // If there's selected context, extract just the question part
      if (selectedContext && initialValue.includes('Question: ')) {
        const questionPart = initialValue.split('Question: ')[1] || '';
        setMessage(questionPart);
      } else {
        setMessage(initialValue);
      }
      
      // Focus and position cursor at end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const messageLength = selectedContext && initialValue.includes('Question: ') 
            ? (initialValue.split('Question: ')[1] || '').length
            : initialValue.length;
          textareaRef.current.setSelectionRange(messageLength, messageLength);
        }
        
        // Auto-send if requested
        if (autoSend && initialValue.trim()) {
          setTimeout(() => {
            if (isSearchMode && onSearch) {
              setIsSearching(true);
              onSearch(initialValue.trim())
                .then(() => {
                  setMessage('');
                  onAutoSendComplete?.();
                })
                .catch((error) => {
                  console.error('Auto-search error:', error);
                  onAutoSendComplete?.();
                })
                .finally(() => {
                  setIsSearching(false);
                });
            } else {
              onSend(initialValue.trim());
              setMessage('');
              onAutoSendComplete?.();
            }
          }, 500); // Small delay for better UX
        }
      }, 100);
    }
  }, [initialValue, autoSend, isSearchMode, onSearch, onSend, onAutoSendComplete, selectedContext, shouldClearMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  // Effect to ensure message stays cleared after sending
  useEffect(() => {
    if (lastSentMessage && message === lastSentMessage) {
      // If the message is the same as what we just sent, clear it again
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, lastSentMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if authentication is required
    if (requireAuth && onAuthRequired) {
      onAuthRequired();
      return;
    }
    
    if (message.trim() && !disabled && !isSearching) {
      // Store the message before stopping recording
      const messageToProcess = message.trim();
      
      // Stop recording if active (do this AFTER capturing the message)
      if (isRecording) {
        stopRecording();
      }
      // Create display message (what user sees in chat)
      let displayMessage = messageToProcess;
      
      // Add document reference to display message if documents attached
      if (attachedDocuments.length > 0) {
        const docNames = attachedDocuments.map(doc => doc.filename).join(', ');
        displayMessage = `${messageToProcess}\n\n📎 Attached: ${docNames}`;
        console.log('📤 Sending message with', attachedDocuments.length, 'attached document(s):', attachedDocuments);
      }
      
      // Clear message IMMEDIATELY to prevent voice input from re-populating it
      setMessage('');
      setLastSentMessage(messageToProcess);
      setShouldClearMessage(true);
      
      // Force clear the textarea immediately
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
      
      // Combine selected context with display message if context exists
      if (selectedContext) {
        displayMessage = `Regarding: "${selectedContext}"\n\nQuestion: ${displayMessage}`;
      }
        
      if (isSearchMode && onSearch) {
        // Handle search mode
        setIsSearching(true);
        onClearContext?.();
        setAttachedDocuments([]);
        
        try {
          // For search mode, enhance with document context before sending to backend
          let searchQuery = displayMessage;
          if (attachedDocuments.length > 0 && conversationId) {
            try {
              const { documentApi } = await import('../../lib/documentApi');
              const relevantChunks = await documentApi.searchDocuments(messageToProcess, conversationId, 5);
              
              if (relevantChunks.length > 0) {
                const documentContext = relevantChunks
                  .map((chunk, index) => `[Document ${index + 1}: ${chunk.filename}]\n${chunk.content}`)
                  .join('\n\n---\n\n');
                
                searchQuery = `${messageToProcess}\n\n--- Document Context ---\n${documentContext}`;
              }
            } catch (error) {
              console.error('Error searching documents:', error);
            }
          }
          
          await onSearch(searchQuery);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
          // Reset the flag after search completes
          setTimeout(() => {
            setShouldClearMessage(false);
          }, 100);
        }
      } else {
        // Handle regular message sending
        onClearContext?.();
        setAttachedDocuments([]);
        
        // Send the clean display message
        // Backend will automatically add document context if documents are uploaded
        onSend(displayMessage);
        
        // Reset the flag after a short delay
        setTimeout(() => {
          setShouldClearMessage(false);
        }, 100);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = message.trim().length > 0 && !disabled && !isSearching;

  const handleFileUploadComplete = (documentId: string, filename: string) => {
    console.log('✅ File uploaded successfully:', documentId, filename);
    // Add document to attached list
    setAttachedDocuments(prev => {
      const updated = [...prev, { id: documentId, filename }];
      console.log('📎 Attached documents:', updated);
      return updated;
    });
    // Close the upload modal
    setShowFileUpload(false);
  };

  const removeAttachedDocument = (documentId: string) => {
    setAttachedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  return (
    <div className="p-6 bg-white dark:bg-[#1a1a1a]">
      <div className="max-w-3xl mx-auto">
        {/* File Upload Modal */}
        <FileUploadModal
          isOpen={showFileUpload}
          onClose={() => setShowFileUpload(false)}
          onUploadComplete={handleFileUploadComplete}
          conversationId={conversationId || ''}
        />
        {/* Selected Context Display */}
        {selectedContext && (
          <div className="mb-3 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Quote size={16} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Selected text:</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 italic">
                  "{(() => {
                    const lines = selectedContext.split('\n');
                    if (lines.length <= 2) {
                      return selectedContext;
                    }
                    return lines.slice(0, 2).join('\n') + '...';
                  })()}"
                </div>
              </div>
              <button
                type="button"
                onClick={onClearContext}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                title="Clear selected text"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="relative">
          {/* Voice error message */}
          {voiceError && (
            <div className="absolute -top-12 left-0 right-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-lg">
              {voiceError}
            </div>
          )}
          
          <div className="flex flex-col bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 rounded-3xl shadow-sm focus-within:shadow-lg focus-within:border-gray-300 dark:focus-within:border-gray-500 transition-all">
            {/* Attached Documents Display - Inside the input area */}
            {attachedDocuments.length > 0 && (
              <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-600">
                {attachedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="inline-flex items-center gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center flex-shrink-0">
                        <Paperclip size={12} className="text-white" />
                      </div>
                      <span className="text-gray-900 dark:text-gray-100 font-medium max-w-[150px] truncate">
                        {doc.filename}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachedDocument(doc.id)}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
                      title="Remove document"
                    >
                      <X size={12} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Input row */}
            <div className="flex items-end">
              {/* Attachment button */}
              <button
                type="button"
                onClick={() => {
                  // If in search mode and no conversation, trigger knowledge toggle first
                  if (isSearchMode && onUploadStart) {
                    onUploadStart();
                  } else {
                    setShowFileUpload(true);
                  }
                }}
                className="flex-shrink-0 p-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={disabled}
                title="Upload documents"
              >
                <Paperclip size={22} />
              </button>

              <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                if (requireAuth && onAuthRequired) {
                  e.preventDefault();
                  onAuthRequired();
                } else {
                  onFocus?.();
                }
              }}
              onClick={(e) => {
                if (requireAuth && onAuthRequired) {
                  e.preventDefault();
                  onAuthRequired();
                }
              }}
              placeholder={requireAuth ? "Please sign in to use branchat" : isRecording ? "Listening..." : placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none bg-transparent border-0 outline-none py-5 pr-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-lg leading-6 max-h-[200px] overflow-y-auto scrollbar-thin"
              style={{ minHeight: '32px' }}
            />

            {/* Voice input button - only show if enabled */}
            {voiceInputEnabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  
                  // If in search mode and not recording, trigger the knowledge toggle
                  if (isSearchMode && !isRecording && onVoiceStart) {
                    onVoiceStart();
                    return;
                  }
                  
                  handleMicClick();
                }}
                className={`flex-shrink-0 p-4 m-2 rounded-full transition-all ${
                  isRecording
                    ? 'text-red-500 dark:text-red-400 animate-pulse'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                disabled={disabled || requireAuth}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}

              {/* Send button */}
              <button
                type="submit"
                disabled={!canSend}
                className={`flex-shrink-0 p-4 m-2 rounded-full transition-all ${
                  canSend
                    ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSearching ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Footer text */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
            branchat can make mistakes. Check important info.
          </div>
        </form>
      </div>
    </div>
  );
}