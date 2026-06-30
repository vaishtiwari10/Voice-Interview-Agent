import { useEffect, useRef, useState, useCallback } from 'react';
import { useVoiceSession } from '../hooks/useVoiceSession.js';
import './InterviewStage.css';

export default function InterviewStage({ language, onEnd }) {
  const {
    status,
    transcript,
    errorMsg,
    questionIndex,
    startSession,
    endSession,
    sendAudio,
    nextQuestion
  } = useVoiceSession();

  const startedRef = useRef(false);
  const videoRef = useRef(null);
  const scrollRef = useRef(null);

  // Mic recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  
  // Recording timer state
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef(null);

  // Derive the active question text from the transcript (last AI message)
  const activeQuestionText = transcript.slice().reverse().find(m => m.role === 'ai')?.text 
    || "Connecting to your interviewer...";

  // Start session & camera
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startSession(language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
      })
      .catch(() => {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            if (cancelled) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }
            streamRef.current = stream;
          })
          .catch(() => {});
      });

    return () => {
      cancelled = true;
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, status]);

  const handleNextQuestion = useCallback(() => {
    nextQuestion();
  }, [nextQuestion]);

  // Mic recording handlers
  const startRecording = useCallback(() => {
    if (status !== 'ready' || !streamRef.current) return;

    audioChunksRef.current = [];
    let options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

    const audioTracks = streamRef.current.getAudioTracks();
    const audioStream = new MediaStream(audioTracks);

    const recorder = new MediaRecorder(audioStream, options);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      sendAudio(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    
    // Start timer
    setRecordDuration(0);
    timerRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  }, [status, sendAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const handleEnd = async () => {
    const feedback = await endSession();
    onEnd(feedback);
  };

  // Format duration as mm:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get professional status label
  const getStatusLabel = () => {
    if (isRecording) return `Recording... (${formatTime(recordDuration)})`;
    if (status === 'transcribing') return 'Processing audio...';
    if (status === 'thinking') return 'AI is evaluating...';
    if (status === 'speaking') return 'AI is speaking...';
    if (status === 'connecting') return 'Connecting to session...';
    if (status === 'analyzing') return 'Finalizing report...';
    return 'Waiting for candidate response...';
  };

  if (status === 'error') {
    return (
      <div className="error-panel card">
        <div className="error-icon">⚠️</div>
        <h2>Connection Error</h2>
        <div className="error-msg">{errorMsg}</div>
        <button className="btn btn-primary" onClick={handleEnd}>Return to Lobby</button>
      </div>
    );
  }

  const isBusy = status !== 'ready' && !isRecording;

  return (
    <div className="interview">
      {/* LEFT PANE: Transcript & Question */}
      <div className="interview-left">
        <div className="active-question-card">
          <div className="question-label">
            Question {questionIndex} of 10
          </div>
          <div className="question-text">
            {activeQuestionText}
          </div>
        </div>

        <div className="transcript-scroll" ref={scrollRef}>
          {transcript.length === 0 && status !== 'error' ? (
            <div className="transcript-empty">
              <div className="spinner" />
              <span>Preparing interview...</span>
            </div>
          ) : (
            <>
              {transcript.map((msg, i) => (
                <div key={i} className={`msg ${msg.role}`}>
                  {msg.role !== 'system' && (
                    <span className="msg-label">
                      {msg.role === 'ai' ? 'Interviewer' : 'Candidate'}
                    </span>
                  )}
                  <div className="msg-bubble">{msg.text}</div>
                </div>
              ))}
              {(status === 'thinking' || status === 'transcribing') && (
                <div className="thinking-skeleton">
                  <div className="skeleton-line skeleton" />
                  <div className="skeleton-line skeleton" />
                  <div className="skeleton-line skeleton" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Video & Controls */}
      <div className="interview-right">
        <div className="video-container">
          <div className="video-box">
            <img src="/avatar.png" alt="AI Interviewer" />
            <span className="video-label">
              <div className={`status-dot ${status === 'speaking' ? 'speaking-active' : ''}`} style={{ background: status === 'speaking' ? 'var(--success)' : 'currentColor' }} />
              Interviewer
            </span>
          </div>
          <div className="video-box">
            <video ref={videoRef} autoPlay muted playsInline />
            <span className="video-label">Candidate (You)</span>
          </div>
        </div>

        <div className="control-panel">
          <div className={`status-badge ${isRecording ? 'recording' : ''} ${status === 'thinking' ? 'thinking' : ''}`}>
            <div className="status-dot" />
            {getStatusLabel()}
          </div>

          <button
            className={`mic-btn ${isRecording ? 'recording' : ''}`}
            onClick={() => isRecording ? stopRecording() : startRecording()}
            disabled={status !== 'ready'}
            aria-label="Click to speak"
          >
            {isRecording ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
            )}
          </button>
          
          <div className="mic-hint">
            {isRecording ? 'Click to send' : 'Click to speak'}
          </div>

          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={handleNextQuestion} disabled={isBusy}>
              Skip Question
            </button>
            <button className="btn btn-danger" onClick={handleEnd}>
              End Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
