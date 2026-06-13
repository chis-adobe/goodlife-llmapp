/**
 * get_progress_report
 * Retrieves a user's full workout history from Supabase.
 * Returns a structured text summary for the LLM to reason over (diet advice,
 * next workout recommendations) plus structured history for the widget.
 */

module.exports = async ({ user_email }) => {
  if (!user_email || typeof user_email !== 'string' || !user_email.trim()) {
    return {
      content: [{ type: 'text', text: 'Please provide a user_email.' }],
      structuredContent: { history: [], summary: {} },
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/goodlifeworkouts?user_email=eq.${encodeURIComponent(user_email.trim())}&order=logged_at.desc&limit=100`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );

  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`);
  const history = await res.json();

  if (!history.length) {
    return {
      content: [{ type: 'text', text: `No workout history found for ${user_email}.` }],
      structuredContent: { history: [], summary: {} },
    };
  }

  // Build per-exercise summary for the LLM
  const summary = {};
  history.forEach(row => {
    if (!summary[row.exercise]) {
      summary[row.exercise] = { totalSets: 0, maxWeight: 0, totalReps: 0, lastLogged: row.logged_at };
    }
    const s = summary[row.exercise];
    s.totalSets += 1;
    s.totalReps += row.reps;
    if (row.weight > s.maxWeight) s.maxWeight = row.weight;
  });

  const lines = Object.entries(summary).map(([exercise, s]) => {
    const date = new Date(s.lastLogged).toLocaleDateString();
    return `${exercise}: ${s.totalSets} sets, max ${s.maxWeight}lbs, ${s.totalReps} total reps, last session ${date}`;
  });

  return {
    content: [{ type: 'text', text: `Workout history for ${user_email}:\n${lines.join('\n')}` }],
    structuredContent: { history, summary },
  };
};
