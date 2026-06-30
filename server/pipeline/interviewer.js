/**
 * LLM Interviewer Integration (Phase 6) — Gemini 2.5 Flash
 */

import Groq from 'groq-sdk';
import { getActiveQuestion, findGroundingMatches } from './retrieval.js';
import { updateSession } from '../session/sessionStore.js';

/** @type {Groq|null} */
let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required for LLM');
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

/**
 * Generate the AI's response to the user's transcript.
 * Retrieves grounding context from Pinecone, builds the prompt, and calls Gemini.
 *
 * @param {string} userTranscript - The STT output of the candidate's answer
 * @param {object} session - The current session object from the store
 * @returns {Promise<string>} The generated AI response text
 */
export async function generateResponse(userTranscript, session) {
  const client = getClient();
  const { id: sessionId, language, history } = session;

  // For the prototype, we assume the active question ID is q01, q02, etc. based on turnCount.
  // We'll pad the current question index to 'q01' format.
  // (In a fuller version, the LLM itself might decide when to move to the next question)
  const questionIndex = session.currentQuestionIndex + 1;
  const questionId = `q${questionIndex.toString().padStart(2, '0')}`;

  console.log(`[LLM] Fetching context for ${questionId} (${language})...`);

  // 1. Fetch deterministic context for the current question
  const activeQuestion = await getActiveQuestion(questionId, language);
  
  if (!activeQuestion) {
    // We ran out of questions!
    updateSession(sessionId, { status: 'completed' });
    return language === 'de' 
      ? 'Das Interview ist abgeschlossen. Vielen Dank für Ihre Zeit!'
      : language === 'hi'
      ? 'इंटरव्यू पूरा हो गया है। अपना समय देने के लिए धन्यवाद!'
      : 'The interview is complete. Thank you for your time!';
  }

  const langName = language === 'de' ? 'German' : language === 'hi' ? 'Hindi' : 'English';

  const nextQuestionId = `q${(questionIndex + 1).toString().padStart(2, '0')}`;
  const nextQuestion = await getActiveQuestion(nextQuestionId, language);

  const systemInstruction = `You are an expert ${langName} speaking technical interviewer conducting a screening interview.
You are extremely natural, conversational, and concise. Your goal is to evaluate the candidate on the current topic.

CURRENT TOPIC: "${activeQuestion.question}"
IDEAL ANSWER COVERS: "${activeQuestion.idealAnswer}"
KEY RUBRIC PHRASES: ${activeQuestion.rubricKeyphrases}
FOLLOW-UP HINT IF THEY STRUGGLE: "${activeQuestion.followUpHint}"

NEXT TOPIC TO ASK (IF CURRENT IS FULLY COVERED): ${nextQuestion ? `"${nextQuestion.question}"` : "None, this is the last question."}

INSTRUCTIONS:
1. Speak completely in ${langName}.
2. Keep your replies very short (1-3 sentences max).
3. If the user's answer is missing key ideal points, ask a natural follow-up question to dig deeper.
4. If they give a completely wrong answer, gently correct them and give them a hint before moving on.
5. If the candidate has sufficiently answered the current topic, you MUST move on. Acknowledge their good answer, and then IMMEDIATELY ask the NEXT TOPIC. If you do this, you MUST append the exact string "[NEXT_QUESTION]" at the very end of your response.
6. NEVER read back the ideal answer or rubric. Act like a human having a conversation.`;

  // Build the conversation history
  const messages = [
    { role: 'system', content: systemInstruction }
  ];

  for (const turn of history) {
    // Map 'interviewer' -> 'assistant', 'candidate' -> 'user'
    const role = turn.role === 'interviewer' ? 'assistant' : 'user';
    messages.push({ role: role, content: turn.content });
  }

  // Add the new user message
  messages.push({ role: 'user', content: userTranscript });

  console.log(`[LLM] Calling Groq Llama 3.3 70B...`);
  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: messages,
    temperature: 0.7,
  });

  let aiText = response.choices[0].message.content;
  let advanced = false;

  if (aiText.includes('[NEXT_QUESTION]')) {
    advanced = true;
    aiText = aiText.replace('[NEXT_QUESTION]', '').trim();
    session.currentQuestionIndex++;
  }

  // Update session history
  history.push({ role: 'candidate', content: userTranscript });
  history.push({ role: 'interviewer', content: aiText });
  updateSession(sessionId, { history });

  return { text: aiText, advanced };
}
