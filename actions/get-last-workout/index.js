/**
 * get_last_workout
 * Fetches the user's most recent workout session from Supabase.
 * The EDS widget (workout-tracker block) reads structuredContent via the bridge
 * to display the last session alongside the input form for the next one.
 */

module.exports = async ({ user_email }) => {
  if (!user_email || typeof user_email !== 'string' || !user_email.trim()) {
    return {
      content: [{ type: 'text', text: 'Please provide a user_email.' }],
      structuredContent: { userEmail: '', lastWorkout: [], lastSessionDate: null },
    };
  }

  const email = user_email.trim();
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/goodlifeworkouts?user_email=eq.${encodeURIComponent(email)}&order=logged_at.desc&limit=50`,
    { headers },
  );
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`);
  const rows = await res.json();

  if (!rows.length) {
    return {
      content: [{ type: 'text', text: `No workout history found for ${email}. Log your first workout to get started.` }],
      structuredContent: { userEmail: email, lastWorkout: [], lastSessionDate: null },
    };
  }

  // Group by calendar date, return the most recent session's sets
  const mostRecentDate = rows[0].logged_at.slice(0, 10);
  const lastWorkout = rows.filter(r => r.logged_at.slice(0, 10) === mostRecentDate);

  const lines = lastWorkout.map(r => `${r.exercise}: ${r.reps} reps @ ${r.weight}lbs`).join(', ');
  const date = new Date(mostRecentDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    content: [{ type: 'text', text: `Last workout for ${email} (${date}): ${lines}` }],
    structuredContent: { userEmail: email, lastWorkout, lastSessionDate: mostRecentDate },
  };
};
