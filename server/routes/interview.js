/**
 * Interview REST routes.
 *
 * POST /api/interview/start   — start a new interview session
 * POST /api/interview/end     — end an interview and get feedback
 * GET  /api/interview/:id     — get session state (for reconnection / debug)
 *
 * The real-time audio pipeline runs over WebSocket (see server/index.js).
 * These REST endpoints handle session lifecycle only.
 */

import { Router } from 'express';
import { createSession, getSession, updateSession } from '../session/sessionStore.js';
import { SUPPORTED_LANGUAGES } from '../i18n/locales.js';

const router = Router();

/**
 * POST /api/interview/start
 * Body: { language?: 'en' | 'hi' | 'de' }
 * Returns: { sessionId, language, status }
 */
router.post('/start', (req, res) => {
  const language = req.body.language || 'en';

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({
      error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
    });
  }

  const session = createSession({ language });

  res.json({
    sessionId: session.id,
    language: session.language,
    status: session.status,
    message: `Interview session created. Connect via WebSocket at /ws to begin.`,
  });
});

/**
 * GET /api/interview/:id
 * Returns current session state (for debugging / reconnection).
 */
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

import { generateFeedback } from '../pipeline/feedback.js';

/**
 * POST /api/interview/:id/end
 * Ends the interview and triggers feedback generation.
 */
router.post('/:id/end', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  updateSession(session.id, { status: 'completed' });

  try {
    const feedback = await generateFeedback(session);
    res.json({
      sessionId: session.id,
      status: 'completed',
      feedback,
      message: 'Interview ended successfully.',
    });
  } catch (err) {
    console.error('[Route] Feedback error:', err);
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

export default router;
