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
  const { firstName, age, email, startWeight, program, duration, result, story, photo, anonymous } = body;

  if (!firstName || !email || !startWeight || !program || !story) {
    throw new Error('Required fields missing');
  }

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const values = [[
    firstName.trim(),
    age         || '',
    email.trim().toLowerCase(),
    startWeight,
    program,
    duration    || '',
    result      || '',
    story.trim(),
    photo       || '',   // colonne I — base64 image
    anonymous === true || anonymous === 'true' ? 'yes' : 'no',  // colonne J
    'pending',           // colonne K — status
    formatDate()         // colonne L
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId:   process.env.GOOGLE_SHARE_STORY_ID,
    range:           `${SHEET_NAME}!A:L`,
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
    range:         `${SHEET_NAME}!A:L`
  });

  const rows = res.data.values || [];

  const stories = rows
    .filter(r => r[10] && r[10].toLowerCase() === 'approved') // colonne K = index 10
    .map(r => ({
      firstName:   r[9] === 'yes' ? 'Anonymous' : (r[0] || 'Anonymous'), // colonne J = index 9
      age:         r[1] || '',
      startWeight: r[3] || '',
      program:     r[4] || '',
      duration:    r[5] || '',
      result:      r[6] || '',
      story:       r[7] || '',
      photo:       r[8] || '',   // colonne I = index 8
      date:        r[11] || ''   // colonne L = index 11
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