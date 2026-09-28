/**
 * /api/ai-tips
 *
 * Secure serverless endpoint that forwards user financial questions
 * to the Anthropic Claude API and returns a beginner-friendly answer.
 *
 * SECURITY NOTES:
 * - The Claude API key is read ONLY from the server-side environment
 *   variable ANTHROPIC_API_KEY. It is never sent to, or readable by,
 *   the browser/frontend.
 * - Configure ANTHROPIC_API_KEY in your Vercel project's Environment
 *   Variables settings (or in a local .env file for `vercel dev`).
 * - Never commit a real API key to git. See .env.example.
 */

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are a friendly, beginner-friendly financial education assistant embedded in an
Indian BFSI (Banking, Financial Services & Insurance) educational web app called "FinWise AI".

Rules you must follow:
- Explain concepts simply, as if to someone new to personal finance.
- Focus on loans, EMIs, credit scores, budgeting, savings, and debt management.
- Never claim to give personalized professional financial, legal, tax, or investment advice.
- Never guarantee loan approval, specific returns, or specific credit score outcomes.
- Keep answers concise: 3-6 short paragraphs or a short bulleted list, in plain text (no markdown symbols).
- If asked something outside personal finance/banking, politely redirect to finance topics.
- Always keep a supportive, non-judgmental, encouraging tone.
- Do not ask for or reference any sensitive personal identifying information.`;

module.exports = async (req, res) => {
  // CORS / method guard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { question } = req.body || {};

    // ---- Input validation & sanitization ----
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'A valid "question" string is required.' });
    }

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length === 0) {
      return res.status(400).json({ error: 'Question cannot be empty.' });
    }

    if (trimmedQuestion.length > 500) {
      return res.status(400).json({ error: 'Question is too long. Please limit to 500 characters.' });
    }

    // Basic sanitization: strip control characters
    const sanitizedQuestion = trimmedQuestion.replace(/[\x00-\x1F\x7F]/g, '');

    // ---- Check API key is configured ----
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not configured in environment variables.');
      return res.status(500).json({
        error: 'AI service is not configured yet. Please set ANTHROPIC_API_KEY in your environment variables.',
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: sanitizedQuestion }],
    });

    const answerText = completion.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!answerText) {
      throw new Error('Empty response received from AI service.');
    }

    const disclaimer =
      '\n\n(Educational guidance only — not professional financial advice.)';

    return res.status(200).json({
      answer: answerText + disclaimer,
    });
  } catch (error) {
    // Never leak internal error details or the API key to the client
    console.error('AI Tips API error:', error?.message || error);

    if (error?.status === 401) {
      return res.status(500).json({ error: 'AI service authentication failed. Please check server configuration.' });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: 'AI service is currently busy. Please try again in a moment.' });
    }

    return res.status(502).json({
      error: 'Failed to get a response from the AI service. Please try again later.',
    });
  }
};
