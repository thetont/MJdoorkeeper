// netlify/functions/writeToSheet.js

const { google } = require('googleapis');

// È FORTEMENTE CONSIGLIATO USARE VARIABILI D'AMBIENTE NETLIFY
// Per test in locale, puoi inserirle qui, ma cancellale prima del deployment:

// const CLIENT_EMAIL = 'IL_TUO_CLIENT_EMAIL_DA_JSON'; 
// const PRIVATE_KEY = 'LA_TUA_PRIVATE_KEY_DA_JSON';
// const SPREADSHEET_ID = 'IL_TUO_SPREADSHEET_ID';

// Usa process.env per accedere alle variabili d'ambiente configurate su Netlify
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

// Funzione principale che Netlify Functions esegue
exports.handler = async (event, context) => {

  // Assicurati che sia una richiesta POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Metodo non consentito, usa POST' }),
    };
  }

  // Analizza il corpo della richiesta JSON inviata dall'estensione
  const data = JSON.parse(event.body);
  const { range, value } = data;

  if (!range || !value) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Mancano i parametri "range" o "value"' }),
    };
  }

  try {
    // Autenticazione con l'account di servizio
    const jwtClient = new google.auth.JWT(
      CLIENT_EMAIL,
      null,
      PRIVATE_KEY.replace(/\\n/g, '\n'), // Netlify potrebbe richiedere questa sostituzione per le interruzioni di riga
      scopes
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    const resource = {
      values: [[value]],
    };

    // Esegue l'aggiornamento sul foglio di calcolo
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: resource,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Scrittura completata per il range: ${range}` }),
    };

  } catch (error) {
    console.error('Errore API Sheets:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Errore durante la scrittura sul foglio: ' + error.message }),
    };
  }
};
