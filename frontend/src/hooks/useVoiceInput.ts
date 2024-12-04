import { useState, useRef, useCallback } from 'react';

interface UseVoiceInputProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceInput({ onTranscript, onError }: UseVoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');
  const isStoppedRef = useRef<boolean>(false);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported. Please use Chrome or Edge.');
      return;
    }

    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Reset transcript and stopped flag
    finalTranscriptRef.current = '';
    isStoppedRef.current = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      // Don't process results if recording was stopped
      if (isStoppedRef.current) {
        return;
      }
      
      let interimTranscript = '';
      let finalTranscript = '';
      
      // Process all results
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update accumulated final transcript
      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
      }

      // Send complete transcript (final + interim) for live display
      const completeTranscript = (finalTranscriptRef.current + interimTranscript).trim();
      if (completeTranscript) {
        onTranscript(completeTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      
      if (event.error === 'not-allowed') {
        onError?.('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        onError?.('No speech detected. Please try again.');
      } else if (event.error !== 'aborted') {
        onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      
      // Only send final transcript if not manually stopped
      if (!isStoppedRef.current && finalTranscriptRef.current.trim()) {
        onTranscript(finalTranscriptRef.current.trim());
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      onError?.('Failed to start recording. Please try again.');
    }
  }, [onTranscript, onError]);

  const stopRecording = useCallback(() => {
    // Mark as stopped to prevent further transcript updates
    isStoppedRef.current = true;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
