/**
 * Retrieval pipeline stage — dual-path retrieval from Pinecone.
 *
 * Two distinct retrieval paths per turn:
 * 1. Deterministic fetch (getActiveQuestion) — pull reference question by known ID
 * 2. Semantic fetch (findGroundingMatches) — embed candidate answer, find nearest rubric/ideal chunks
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from './embeddings.js';

const INDEX_NAME = process.env.PINECONE_INDEX || 'ai-intern-qa';

/** @type {import('@pinecone-database/pinecone').Index|null} */
let _index = null;

/**
 * Get or create the Pinecone index handle (lazy singleton).
 * @returns {import('@pinecone-database/pinecone').Index}
 */
function getIndex() {
  if (!_index) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is required for retrieval');
    }
    const pc = new Pinecone({ apiKey });
    _index = pc.index(INDEX_NAME);
  }
  return _index;
}

/**
 * Deterministic fetch — pull the currently active reference question by ID.
 *
 * Uses Pinecone's `fetch()` with known vector IDs (not semantic search).
 * This is cheap (no compute units for similarity), deterministic, and fast.
 *
 * @param {string} questionId - Stable question ID (e.g. 'q01')
 * @param {string} language - Language key ('en', 'hi', 'de')
 * @returns {Promise<object|null>} Structured question data, or null if not found
 *   { questionId, language, question, idealAnswer, rubricKeyphrases, followUpHint }
 */
export async function getActiveQuestion(questionId, language = 'en') {
  const index = getIndex();

  // Fetch all 3 chunks by their deterministic IDs
  const ids = [
    `${questionId}-${language}-question`,
    `${questionId}-${language}-ideal_answer`,
    `${questionId}-${language}-rubric`,
  ];

  const result = await index.fetch(ids);
  const records = result.records || {};

  const questionRec = records[`${questionId}-${language}-question`];
  const idealRec = records[`${questionId}-${language}-ideal_answer`];
  const rubricRec = records[`${questionId}-${language}-rubric`];

  // If the question chunk doesn't exist, the ID is invalid
  if (!questionRec) {
    return null;
  }

  return {
    questionId,
    language,
    category: questionRec.metadata.category,
    difficulty: questionRec.metadata.difficulty,
    question: questionRec.metadata.text,
    idealAnswer: idealRec?.metadata?.text || '',
    rubricKeyphrases: rubricRec?.metadata?.rubricText || '',
    followUpHint: rubricRec?.metadata?.followUpHint || '',
  };
}

/**
 * Semantic fetch — embed the candidate's answer and query for nearest
 * matching ideal-answer chunks and rubric keyphrases.
 *
 * This is the actual "grounding" — without it the LLM would be judging
 * answers from its own opinion of what's correct.
 *
 * @param {string} candidateAnswerText - Transcribed candidate answer
 * @param {string} language - Language key ('en', 'hi', 'de')
 * @param {number} topK - Number of results to return (default 3)
 * @returns {Promise<object[]>} Matching grounding chunks with scores
 *   [{ questionId, chunkType, text, rubricText, followUpHint, score }]
 */
export async function findGroundingMatches(candidateAnswerText, language = 'en', topK = 3) {
  const index = getIndex();

  // Embed the candidate's answer
  const queryVector = await embedText(candidateAnswerText);

  // Query Pinecone — filter to ideal_answer and rubric chunks in the target language
  const result = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: {
      language: { $eq: language },
      chunkType: { $in: ['ideal_answer', 'rubric'] },
    },
  });

  // Map to a clean return shape
  return (result.matches || []).map((match) => ({
    questionId: match.metadata.questionId,
    chunkType: match.metadata.chunkType,
    category: match.metadata.category,
    difficulty: match.metadata.difficulty,
    text: match.metadata.text,
    rubricText: match.metadata.rubricText || null,
    followUpHint: match.metadata.followUpHint || null,
    score: match.score,
  }));
}
