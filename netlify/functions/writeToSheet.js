// netlify/functions/writeToSheet.js

const { google } = require('googleapis');

// È FORTEMENTE CONSIGLIATO USARE VARIABILI D'AMBIENTE NETLIFY
// Per test in locale, puoi inserirle qui, ma cancellale prima del deployment:

// const CLIENT_EMAIL = 'IL_TUO_CLIENT_EMAIL_DA_JSON'; 
// const PRIVATE_KEY = 'LA_TUA_PRIVATE_KEY_DA_JSON';
// const SPREADSHEET_ID = 'IL_TUO_SPREADSHEET_ID';

// Usa process.env per accedere alle variabili d'ambiente configurate su Netlify
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const PRIVATE_KEY_RAW = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

// Funzione principale che Netlify Functions esegue
exports.handler = async (event, context) => {

  // --- INIZIO GESTIONE RICHIESTA OPTIONS/PREFLIGHT ---
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204, // 204 No Content è la risposta standard per OPTIONS
      headers: {
        'Access-Control-Allow-Origin': '*', // Consenti l'origine della tua estensione
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // Specifica i metodi consentiti
        'Access-Control-Allow-Headers': 'Content-Type', // Specifica gli header consentiti
        'Access-Control-Max-Age': '86400', // Memorizza nella cache questa risposta OPTIONS per 24 ore
      },
      body: '' // Il corpo deve essere vuoto per 204
    };
  }
  // --- FINE GESTIONE RICHIESTA OPTIONS/PREFLIGHT ---

  // Assicurati che sia una richiesta POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*' // Aggiunto
      },
      body: JSON.stringify({ message: 'Metodo non consentito, usa POST' }),
    };
  }

  // Validate environment variables early to avoid uncaught exceptions
  if (!CLIENT_EMAIL || !PRIVATE_KEY_RAW || !SPREADSHEET_ID) {
    console.error('Environment variable missing. Check GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID.');
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Server misconfiguration: missing Google Sheets credentials. Controlla le variabili d\'ambiente.' }),
    };
  }

  // Safely normalize private key newlines. The key may contain either literal '\\n' sequences or real newlines.
  const PRIVATE_KEY = typeof PRIVATE_KEY_RAW === 'string'
    ? PRIVATE_KEY_RAW.replace(/\n/g, '\n')
    : PRIVATE_KEY_RAW;

  // Analizza il corpo della richiesta JSON inviata dall'estensione
  let data;
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Request body vuoto' }),
      };
    }
    data = JSON.parse(event.body);
  } catch (parseErr) {
    console.error('Failed to parse JSON body:', parseErr);
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'JSON non valido nel body della richiesta', details: parseErr.message }),
    };
  }

  const { range, value } = data;

  if (!range || (typeof value === 'undefined' || value === null)) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*' // Aggiunto
      },
      body: JSON.stringify({ message: 'Mancano i parametri "range" o "value"' }),
    };
  }

  try {
    // Autenticazione con l'account di servizio
    const jwtClient = new google.auth.JWT(
      CLIENT_EMAIL,
      null,
      PRIVATE_KEY,
      scopes
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    const resource = {
      values: [[value]],
    };

    // Esegue l'aggiornamento sul foglio di calcolo
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: resource,
    });

    console.info('Sheets API update result:', res.status, res.statusText);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*' // Aggiunto
      },
      body: JSON.stringify({ message: `Scrittura completata per il range: ${range}` }),
    };

  } catch (error) {
    // Log full error server-side (avoid printing secrets)
    console.error('Errore API Sheets:', error);
    const clientMessage = (error && error.message) ? error.message : 'Errore sconosciuto';
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*' // Aggiunto
      },
      body: JSON.stringify({ message: 'Errore durante la scrittura sul foglio', details: clientMessage }),
    };
  }
};
