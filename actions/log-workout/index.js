/**
 * log_workout
 * Writes a new workout session to Supabase and returns both the new session
 * and the previous one so the LLM can compare progress and make recommendations.
 */

module.exports = async ({ user_email, sets = [] }) => {
  if (!user_email || typeof user_email !== 'string' || !user_email.trim()) {
    return {
      content: [{ type: 'text', text: 'Please provide a user_email.' }],
      structuredContent: { logged: 0, newWorkout: [], previousWorkout: [] },
    };
  }

  if (!Array.isArray(sets) || sets.length === 0) {
    return {
      content: [{ type: 'text', text: 'Please provide at least one set to log.' }],
      structuredContent: { logged: 0, newWorkout: [], previousWorkout: [] },
    };
  }

  const email = user_email.trim();
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  // Fetch previous workout before inserting so we can compare
  const prevRes = await fetch(
    `${SUPABASE_URL}/rest/v1/goodlifeworkouts?user_email=eq.${encodeURIComponent(email)}&order=logged_at.desc&limit=50`,
    { headers },
  );
  if (!prevRes.ok) throw new Error(`Supabase query failed: ${prevRes.status}`);
  const existing = await prevRes.json();

  const previousDate = existing.length ? existing[0].logged_at.slice(0, 10) : null;
  const previousWorkout = previousDate
    ? existing.filter(r => r.logged_at.slice(0, 10) === previousDate)
    : [];

  // Insert new sets
  const rows = sets.map(s => ({
    user_email: email,
    exercise: s.exercise,
    reps: Number(s.reps),
    weight: Number(s.weight),
  }));

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/goodlifeworkouts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!insertRes.ok) throw new Error(`Supabase insert failed: ${insertRes.status}`);

  // Build comparison text for the LLM
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const newLines = rows.map(r => `${r.exercise}: ${r.reps} reps @ ${r.weight}lbs`).join('\n');

  let comparisonText = `New workout logged for ${email} on ${today}:\n${newLines}`;

  if (previousWorkout.length) {
    const prevDate = new Date(previousDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    const prevLines = previousWorkout.map(r => `${r.exercise}: ${r.reps} reps @ ${r.weight}lbs`).join('\n');
    comparisonText += `\n\nPrevious workout (${prevDate}):\n${prevLines}`;
  } else {
    comparisonText += '\n\nThis is the user\'s first logged workout.';
  }

  return {
    content: [{ type: 'text', text: comparisonText }],
    structuredContent: { logged: rows.length, newWorkout: rows, previousWorkout },
  };
};
