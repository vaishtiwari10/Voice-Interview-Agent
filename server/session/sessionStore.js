/**
 * In-memory session store for interview sessions.
 * Uses a Map<sessionId, sessionState> — adequate for a prototype.
 * Swap for Redis if persistence/horizontal scaling is needed.
 */

import { randomUUID } from 'crypto';

/** @type {Map<string, object>} */
const sessions = new Map();

/**
 * Create a new interview session.
 * @param {object} options
 * @param {string} [options.language='en'] - Interview language
 * @returns {object} The created session state
 */
export function createSession({ language = 'en' } = {}) {
  const session = {
    id: randomUUID(),
    language,
    currentQuestionIndex: 0,
    turnCount: 0,
    history: [], // { role: 'interviewer'|'candidate', content: string }
    questionResults: [], // per-question notes for feedback generation
    status: 'active', // 'active' | 'completed'
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  console.log(`[Session] Created ${session.id} (lang=${language})`);
  return session;
}

/**
 * Get a session by ID.
 * @param {string} sessionId
 * @returns {object|undefined}
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Update a session's state (shallow merge).
 * @param {string} sessionId
 * @param {object} updates - Fields to merge into the session
 * @returns {object} The updated session
 */
export function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  Object.assign(session, updates);
  return session;
}

/**
 * Delete a session.
 * @param {string} sessionId
 * @returns {boolean} Whether the session existed
 */
export function deleteSession(sessionId) {
  console.log(`[Session] Deleted ${sessionId}`);
  return sessions.delete(sessionId);
}

/**
 * List all active sessions (for debugging).
 * @returns {object[]}
 */
export function listSessions() {
  return Array.from(sessions.values());
}
