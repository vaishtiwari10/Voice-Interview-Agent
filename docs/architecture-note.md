# Architecture Note

## 7. Trade-offs (Latency vs. Accuracy vs. Cost)

When designing the real-time audio pipeline, several trade-offs were made to balance a premium user experience with prototype constraints:

- **Audio Transmission (Hold-to-Talk vs. VAD):** 
  Instead of implementing continuous Voice Activity Detection (VAD) and streaming raw PCM bytes—which is highly susceptible to background noise and requires complex client-side audio processing—we opted for a "Hold-to-Talk" WebM Blob transmission. This slightly increases latency (since STT cannot begin until the user finishes speaking) but drastically improves transcription accuracy and reduces accidental LLM triggers.
- **Model Selection:** 
  We chose `whisper-large-v3` on Groq over smaller local models. While local STT eliminates network latency, Groq's LPU inference is so fast that the network round-trip is negligible, and we gain state-of-the-art multilingual accuracy for free. Similarly, Gemini 2.5 Flash was chosen over Pro for its extreme speed and native JSON structured output capabilities.
- **ElevenLabs Streaming:**
  Instead of waiting for the full MP3 file to generate, the backend pipes the `ReadableStream` directly from ElevenLabs to the WebSocket client as binary chunks. This minimizes the time-to-first-byte (TTFB) so the user hears the AI start speaking almost instantly after the LLM generates its response.

## 8. Edge Cases Handled

The following edge cases and potential failure modes have been mitigated in the architecture:

- **Browser Audio Format Discrepancies:** iOS Safari does not natively support recording in standard WebM/Opus. The frontend attempts to request `audio/webm;codecs=opus`, but gracefully falls back to the browser's default MIME type if unsupported. Groq's Whisper API accepts both transparently.
- **Multilingual Context Switching:** If a user selects "German", the system must ensure the LLM doesn't reply in English. This is handled by dynamically injecting the language preference into both the deterministic Pinecone metadata filter and the Gemini system prompt. ElevenLabs' `eleven_multilingual_v2` model seamlessly synthesizes the resulting non-English text without needing voice ID swapping.
- **Premature Interview Termination:** If a user clicks "End Interview" before answering any questions, the feedback generator would traditionally hallucinate or fail. The `feedback.js` module explicitly checks the session history length and returns a safe "Not enough data" JSON fallback if the history is too short.
- **Stale WebSocket Connections:** The Node.js WebSocket server cleans up session references upon the `ws.on('close')` event to prevent memory leaks if the client refreshes the page mid-interview.

## 9. Next Steps (Beyond the Prototype)

If this prototype were to be scaled into a production system, the following areas would be prioritized:

1. **Full-Duplex Interruption (Barge-in):** Currently, the user must wait for the AI to finish speaking. We would implement a continuous WebRTC or dual-channel WebSocket stream with client-side VAD, allowing the user to interrupt the AI mid-sentence.
2. **Persistent Session Storage:** The in-memory `Map` used in `sessionStore.js` would be replaced with Redis for horizontal scaling and PostgreSQL for long-term storage of candidate transcripts and feedback reports.
3. **Dynamic Evaluation Logic:** Instead of iterating through questions deterministically (`q01`, `q02`), the LLM would be given a tool (function calling) to autonomously decide when a candidate has satisfactorily answered a topic and dynamically select the next most appropriate question from the vector database.
