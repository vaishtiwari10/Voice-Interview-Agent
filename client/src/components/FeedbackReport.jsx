import { useEffect, useState } from 'react';
import './FeedbackReport.css';

export default function FeedbackReport({ feedback, onRestart }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (feedback && feedback.overall_score !== undefined) {
      setTimeout(() => {
        setAnimatedScore(feedback.overall_score);
      }, 100);
    }
  }, [feedback]);

  if (!feedback) {
    return (
      <div className="feedback-report" style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="spinner" style={{ margin: '0 auto 24px' }}></div>
        <p>Generating your evaluation report...</p>
      </div>
    );
  }

  const { overall_score: overallScore, strengths = [], weaknesses = [], detailed_summary: detailedSummary } = feedback;

  let statusClass = 'status-excellent';
  let statusText = 'Excellent';
  if (overallScore < 70) {
    statusClass = 'status-needs-work';
    statusText = 'Needs Improvement';
  } else if (overallScore < 85) {
    statusClass = 'status-good';
    statusText = 'Good';
  }

  return (
    <div className="feedback-report card">
      <div className="report-header">
        <h2>Candidate Evaluation Report</h2>
        <p className="report-desc">Review your technical interview performance</p>
      </div>

      <div className="score-section">
        <div className="score-visual">
          <div className="score-bar-bg">
            <div 
              className="score-bar-fill" 
              style={{ width: `${animatedScore}%` }}
            />
          </div>
        </div>
        <div className={`score-details ${statusClass}`}>
          <span>Overall Score</span>
          <span>{animatedScore}/100 - {statusText}</span>
        </div>
      </div>

      {detailedSummary && (
        <div className="summary-section">
          <h3>Summary</h3>
          <p>{detailedSummary}</p>
        </div>
      )}

      <div className="evaluation-grid">
        <div className="eval-card strengths">
          <h3 className="strengths-title">Key Strengths</h3>
          {strengths.length > 0 ? (
            <ul className="eval-list">
              {strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : (
            <p className="empty-text">No significant strengths recorded.</p>
          )}
        </div>
        
        <div className="eval-card weaknesses">
          <h3 className="weaknesses-title">Areas for Improvement</h3>
          {weaknesses.length > 0 ? (
            <ul className="eval-list">
              {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          ) : (
            <p className="empty-text">No significant areas for improvement recorded.</p>
          )}
        </div>
      </div>

      <div className="report-actions">
        <button className="btn btn-primary btn-lg" onClick={onRestart}>
          Begin New Interview
        </button>
      </div>
    </div>
  );
}
