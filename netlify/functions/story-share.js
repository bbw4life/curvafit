const { google } = require('googleapis');

const SHEET_NAME = 'StoryBbw';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

function formatDate() {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(-2)}`;
}

// ── SAVE ──────────────────────────────────────────────────────────────
async function saveStory(body) {
  const { firstName, age, email, startWeight, program, duration, result, story, anonymous } = body;

  if (!firstName || !email || !startWeight || !program || !story) {
    throw new Error('Required fields missing');
  }

  const auth  = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const values = [[
    firstName.trim(),
    age        || '',
    email.trim().toLowerCase(),
    startWeight,
    program,
    duration   || '',
    result     || '',
    story.trim(),
    anonymous === true || anonymous === 'true' ? 'yes' : 'no',
    'pending',       // status: pending | approved
    formatDate()
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId:   process.env.GOOGLE_SHARE_STORY_ID,
    range:           `${SHEET_NAME}!A:K`,
    valueInputOption:'RAW',
    insertDataOption:'INSERT_ROWS',
    resource: { values }
  });

  return { success: true };
}

// ── FETCH approved stories ─────────────────────────────────────────────
async function fetchStories() {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHARE_STORY_ID,
    range:         `${SHEET_NAME}!A:K`
  });

  const rows = res.data.values || [];
  // rows: [firstName, age, email, startWeight, program, duration, result, story, anonymous, status, date]

  const stories = rows
    .filter(r => r[9] && r[9].toLowerCase() === 'approved')
    .map(r => ({
      firstName:   r[8] === 'yes' ? 'Anonymous' : (r[0] || 'Anonymous'),
      age:         r[1] || '',
      startWeight: r[3] || '',
      program:     r[4] || '',
      duration:    r[5] || '',
      result:      r[6] || '',
      story:       r[7] || '',
      date:        r[10] || ''
    }));

  return { success: true, stories };
}

// ── HANDLER ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const data = await saveStory(body);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'GET') {
      const data = await fetchStories();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  } catch (err) {
    console.error('STORY-SHARE ERROR:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};