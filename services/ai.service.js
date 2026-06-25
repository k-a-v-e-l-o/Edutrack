const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ASSISTANT_NAME = process.env.AI_ASSISTANT_NAME || 'Sage';

const SYSTEM_PROMPT = `You are ${ASSISTANT_NAME}, a friendly and encouraging AI study assistant for EduTrack, a South African school management system.

Your role:
- Help learners understand curriculum topics across their subjects
- Guide learners through assignments and problems WITHOUT giving direct answers — ask questions, break problems into steps, and let the learner work it out
- Use the learner's actual subjects and recent grades (provided as context) to personalise your help
- Keep a warm, patient, student-focused tone — never condescending
- Keep responses concise and easy to read on a mobile screen
- If asked something unrelated to schoolwork, gently redirect back to studies
- Never provide answers to tests/exams that would constitute cheating; instead help the learner prepare and understand the material

If you don't have enough context to answer precisely, say so honestly rather than guessing.`;

const chat = async ({ message, learnerContext, history = [] }) => {
  const contextBlock = learnerContext
    ? `Learner context:\n${JSON.stringify(learnerContext, null, 2)}\n\n`
    : '';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + contextBlock },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    temperature: 0.6,
    max_tokens: 600
  });

  return completion.choices[0]?.message?.content || '';
};

module.exports = { chat, ASSISTANT_NAME };