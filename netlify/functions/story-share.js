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
  const { firstName, age, email, country, startWeight, program, duration, result, waist, failedBefore, story, rating, photo, anonymous } = body;

  if (!firstName || !email || !startWeight || !program || !story) {
    throw new Error('Required fields missing');
  }

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Colonnes : A=firstName, B=age, C=email, D=country, E=startWeight,
  //            F=program, G=duration, H=result, I=waist, J=failedBefore,
  //            K=story, L=rating, M=photo, N=anonymous, O=status, P=date
  const values = [[
    firstName.trim(),
    age           || '',
    email.trim().toLowerCase(),
    country       || '',
    startWeight,
    program,
    duration      || '',
    result        || '',
    waist         || '',
    failedBefore  || '',
    story.trim(),
    rating        || '5',
    photo         || '',
    anonymous === true || anonymous === 'true' ? 'yes' : 'no',
    'pending',
    formatDate()
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId:   process.env.GOOGLE_SHARE_STORY_ID,
    range:           `${SHEET_NAME}!A:P`,
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
    range:         `${SHEET_NAME}!A:P`
  });

  const rows = res.data.values || [];

  // A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9,
  // K=10, L=11, M=12, N=13, O=14, P=15
  const stories = rows
    .slice(1) // skip header row
    .filter(r => r[14] && r[14].toString().toLowerCase() === 'approved')
    .map(r => ({
      firstName:   r[13] && r[13].toString().toLowerCase() === 'yes' ? 'Anonymous' : (r[0] || 'Anonymous'),
      age:         r[1]  || '',
      country:     r[3]  || '',
      startWeight: r[4]  || '',
      program:     r[5]  || '',
      duration:    r[6]  || '',
      result:      r[7]  || '',
      waist:       r[8]  || '',
      failedBefore:r[9]  || '',
      story:       r[10] || '',
      rating:      r[11] || '5',
      photo:       r[12] || '',
      date:        r[15] || ''
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