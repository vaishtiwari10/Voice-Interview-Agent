/**
 * Feedback Generation (Phase 10)
 * Uses Groq Llama 3.3 structured JSON output to evaluate the interview.
 */

import Groq from 'groq-sdk';

/** @type {Groq|null} */
let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required for feedback');
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

/**
 * Generate a structured feedback report from the session history.
 * @param {object} session
 * @returns {Promise<object>} The feedback report
 */
export async function generateFeedback(session) {
  const { history, language } = session;

  if (!history || history.length < 2) {
    return {
      overall_score: 0,
      strengths: ['Not enough data'],
      weaknesses: ['Not enough data'],
      detailed_summary: 'The interview ended before enough questions were answered to provide a meaningful evaluation.',
    };
  }

  const client = getClient();
  const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

  console.log(`[Feedback] Generating report for session ${session.id}...`);

  const systemInstruction = `You are a Senior Engineering Manager evaluating an AI Intern candidate.
Review the following transcript between the INTERVIEWER (you) and the CANDIDATE.
Evaluate the candidate's technical knowledge (ML fundamentals, tooling, debugging) and communication skills.
Provide a fair, objective assessment. Be specific about concepts they got right or wrong.

You MUST respond in pure JSON format matching this exact schema:
{
  "overall_score": <integer from 0 to 100>,
  "strengths": ["string", "string"], // 2 to 3 bullet points of what they did well
  "weaknesses": ["string", "string"], // 2 to 3 bullet points of areas to improve
  "detailed_summary": "A 2-paragraph summary of the performance in ${language === 'de' ? 'German' : language === 'hi' ? 'Hindi' : 'English'}"
}`;

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: transcript }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  try {
    const feedback = JSON.parse(response.choices[0].message.content);
    return feedback;
  } catch (err) {
    console.error('[Feedback] Failed to parse JSON from LLM:', response.choices[0].message.content);
    throw new Error('Failed to generate structured feedback.');
  }
}
