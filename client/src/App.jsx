import { useState } from 'react';
import InterviewStage from './components/InterviewStage.jsx';
import FeedbackReport from './components/FeedbackReport.jsx';
import './App.css';

function App() {
  const [stage, setStage] = useState('setup'); // setup | interview | feedback
  const [language, setLanguage] = useState('en');
  const [feedback, setFeedback] = useState(null);

  const handleEndInterview = (finalFeedback) => {
    setFeedback(finalFeedback);
    setStage('feedback');
  };

  const handleRestart = () => {
    setFeedback(null);
    setStage('setup');
  };

  const handleStartSession = () => {
    // Unlock browser autoplay policy
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctx.resume();
    }
    setStage('interview');
  };

  return (
    <div className="app">
      {/* Professional Top Bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">AC</div>
          <span className="topbar-title">Acme Corp Screening</span>
        </div>
        <div className="topbar-right">
          <div className="candidate-profile">
            <div className="candidate-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            Candidate
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {stage === 'setup' && (
          <div className="lobby card" id="setup-panel">
            <div className="lobby-header">
              <div className="lobby-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
              </div>
              <h2>Interview Waiting Room</h2>
              <p className="lobby-desc">
                Welcome. You are about to begin a technical screening interview. Please ensure you are in a quiet environment and your microphone is working.
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="lang-select">Interview Language</label>
              <select
                id="lang-select"
                className="field-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English (US)</option>
                <option value="hi">Hindi (IN)</option>
                <option value="de">German (DE)</option>
              </select>
            </div>

            <button className="btn btn-primary btn-lg" id="start-btn" onClick={handleStartSession}>
              Join Interview
            </button>
          </div>
        )}

        {stage === 'interview' && (
          <InterviewStage language={language} onEnd={handleEndInterview} />
        )}

        {stage === 'feedback' && (
          <FeedbackReport feedback={feedback} onRestart={handleRestart} />
        )}
      </main>
    </div>
  );
}

export default App;
