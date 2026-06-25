const { query } = require('../db');
const aiService = require('../services/ai.service');

// ─── Get Learner Context (subjects + recent grades) ──────────────
const getLearnerContext = async (learnerId) => {
  try {
    const grades = await query(
      `SELECT
         s.name AS subject,
         ROUND(AVG(m.marks_obtained / a.total_marks * 100), 2) AS average,
         a.term
       FROM marks m
       JOIN assessments a   ON a.id = m.assessment_id
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       JOIN subjects s        ON s.id  = cs.subject_id
       WHERE m.learner_id = $1
       GROUP BY s.name, a.term
       ORDER BY a.term DESC`,
      [learnerId]
    );

    return {
      subjects_and_averages: grades.rows
    };
  } catch (err) {
    console.error('AI getLearnerContext error:', err.message);
    return null;
  }
};

// ─── Send chat message ────────────────────────────────────────────
const sendChatMessage = async (req, res) => {
  try {
    const { message, history } = req.body;
    const learnerId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        success: false,
        message: `${aiService.ASSISTANT_NAME} is currently unavailable. Please try again later.`
      });
    }

    const learnerContext = await getLearnerContext(learnerId);

    const reply = await aiService.chat({
      message: message.trim(),
      learnerContext,
      history: Array.isArray(history) ? history.slice(-10) : []
    });

    // Persist conversation (best-effort, doesn't fail the request if it errors)
    try {
      await query(
        `INSERT INTO ai_conversations (user_id, role, content) VALUES ($1, 'user', $2)`,
        [learnerId, message.trim()]
      );
      await query(
        `INSERT INTO ai_conversations (user_id, role, content) VALUES ($1, 'assistant', $2)`,
        [learnerId, reply]
      );
    } catch (persistErr) {
      console.error('AI history save error:', persistErr.message);
    }

    return res.status(200).json({
      success: true,
      assistant: aiService.ASSISTANT_NAME,
      reply
    });
  } catch (err) {
    console.error('AI sendChatMessage error:', err.message);
    return res.status(500).json({
      success: false,
      message: `${aiService.ASSISTANT_NAME} ran into a problem. Please try again.`
    });
  }
};

// ─── Get conversation history ─────────────────────────────────────
const getChatHistory = async (req, res) => {
  try {
    const result = await query(
      `SELECT role, content, created_at
       FROM ai_conversations
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 50`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, history: result.rows });
  } catch (err) {
    console.error('AI getChatHistory error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { sendChatMessage, getChatHistory };