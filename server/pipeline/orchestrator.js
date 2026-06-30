/**
 * WebSocket Orchestrator (Phase 4)
 * Manages the flow of audio from the client -> STT -> LLM -> TTS -> client.
 */

import { getSession } from '../session/sessionStore.js';
import { transcribeAudio } from './stt.js';
import { generateResponse } from './interviewer.js';
import { synthesizeAndStream } from './tts.js';

/**
 * Handle a new WebSocket connection.
 * @param {import('ws').WebSocket} ws
 */
export function handleConnection(ws) {
  let session = null;

  console.log('[WS] Client connected');

  ws.on('message', async (data, isBinary) => {
    try {
      if (!isBinary) {
        // Control message (JSON)
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'init') {
          session = getSession(msg.sessionId);
          if (!session) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid session ID' }));
            ws.close();
            return;
          }
          console.log(`[WS] Initialized pipeline for session ${session.id}`);
          ws.send(JSON.stringify({ type: 'status', status: 'ready' }));
          ws.send(JSON.stringify({ type: 'question_update', questionNumber: session.currentQuestionIndex + 1 }));
          
          // Kick off the interview with the first question immediately
          if (session.history.length === 0) {
            ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
            const aiResponse = await generateResponse('Hello, I am ready to start.', session);
            ws.send(JSON.stringify({ type: 'transcript', text: aiResponse.text, role: 'ai' }));
            ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
            await synthesizeAndStream(aiResponse.text, ws, session.language);
            ws.send(JSON.stringify({ type: 'status', status: 'ready' }));
          }
        }
        else if (msg.type === 'next_question') {
          if (session) {
            session.currentQuestionIndex++;
            ws.send(JSON.stringify({ type: 'question_update', questionNumber: session.currentQuestionIndex + 1 }));
            ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
            const aiResponse = await generateResponse('I am ready for the next question.', session);
            ws.send(JSON.stringify({ type: 'transcript', text: aiResponse.text, role: 'ai' }));
            ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
            await synthesizeAndStream(aiResponse.text, ws, session.language);
            ws.send(JSON.stringify({ type: 'status', status: 'ready' }));
          }
        }
      } else {
        // Binary message (User's audio chunk)
        if (!session) {
          console.warn('[WS] Received audio before init');
          return;
        }

        console.log(`[WS] Received audio blob (${data.length} bytes)`);
        
        // 1. STT
        ws.send(JSON.stringify({ type: 'status', status: 'transcribing' }));
        const transcript = await transcribeAudio(data, session.language);
        
        if (!transcript) {
          ws.send(JSON.stringify({ type: 'transcript', text: "(No speech detected, please try again)", role: 'system' }));
          ws.send(JSON.stringify({ type: 'status', status: 'ready' }));
          return;
        }
        
        ws.send(JSON.stringify({ type: 'transcript', text: transcript, role: 'user' }));

        // 2. LLM
        ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));
        const aiResponse = await generateResponse(transcript, session);
        ws.send(JSON.stringify({ type: 'transcript', text: aiResponse.text, role: 'ai' }));

        // 3. TTS
        ws.send(JSON.stringify({ type: 'status', status: 'speaking' }));
        await synthesizeAndStream(aiResponse.text, ws, session.language);
        
        if (aiResponse.advanced) {
          ws.send(JSON.stringify({ type: 'question_update', questionNumber: session.currentQuestionIndex + 1 }));
        }

        ws.send(JSON.stringify({ type: 'status', status: 'ready' }));
      }
    } catch (err) {
      console.error('[WS] Error in pipeline:', err);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    session = null;
  });
}
