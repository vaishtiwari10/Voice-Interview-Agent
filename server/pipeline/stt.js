/**
 * STT Integration (Phase 5) — Groq Whisper
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import Groq from 'groq-sdk';

/** @type {Groq|null} */
let _groq = null;

function getGroq() {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required for STT');
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

/**
 * Transcribe binary WebM audio buffer to text.
 * The Groq SDK requires a file stream, so this temporarily saves the buffer to disk.
 *
 * @param {Buffer} audioBuffer - WebM/Opus audio buffer from the client
 * @param {string} [language='en'] - Hint for the transcriber ('en', 'hi', 'de')
 * @returns {Promise<string>} The transcribed text
 */
export async function transcribeAudio(audioBuffer, language = 'en') {
  if (!audioBuffer || audioBuffer.length === 0) {
    return '';
  }

  const client = getGroq();
  const tempFilePath = path.join(os.tmpdir(), `ai-intern-${randomUUID()}.webm`);

  try {
    // 1. Write the buffer to a temporary file
    await fs.writeFile(tempFilePath, audioBuffer);

    // 2. Call Groq API
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(tempFilePath),
      model: 'whisper-large-v3-turbo', // Faster + better for short conversational clips
      language: language,
      response_format: 'json',
      temperature: 0.0,
      // Prompt hint: dramatically improves accuracy by telling Whisper the domain context.
      // Whisper uses this to bias its decoder toward technical vocabulary.
      prompt: 'This is a technical software engineering interview. Topics include machine learning, neural networks, Python, TensorFlow, PyTorch, debugging, data pipelines, APIs, and AI ethics.',
    });

    return transcription.text.trim();
  } catch (err) {
    console.error('[STT] Transcription failed:', err.message);
    throw err;
  } finally {
    // 3. Clean up the temporary file immediately
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupErr) {
      console.warn(`[STT] Failed to delete temp file ${tempFilePath}:`, cleanupErr.message);
    }
  }
}
