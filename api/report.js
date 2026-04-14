import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0173002338",
  appId: process.env.FIREBASE_APP_ID || "1:169103756685:web:e0df3273bac058b49f41c4",
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCZxgtoCFDTbVt6Kil-IwsvylSHywb6Gdg",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0173002338.firebaseapp.com",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0173002338.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "169103756685",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
};

let db;
try {
    const app = initializeApp(firebaseConfig);
    const databaseId = process.env.FIREBASE_DATABASE_ID || "ai-studio-02964cf0-58a8-4cf7-bb15-c51b69cf1fac";
    db = getFirestore(app, databaseId);
} catch (e) {
    console.error("Failed to init Firebase client:", e);
}

export default async function handler(request, response) {
  // 1. permissive CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, originalText, aiResult, userCorrection, userNotes } = request.body;

    if (!userCorrection) {
      return response.status(400).json({ error: 'Missing userCorrection' });
    }

    await addDoc(collection(db, 'reports'), {
      user_id: userId === 'anonymous' ? null : userId,
      original_text: originalText || '',
      ai_result: aiResult || {},
      user_correction: userCorrection,
      user_notes: userNotes || '',
      created_at: serverTimestamp()
    });

    return response.status(200).json({ success: true });
  } catch (error) {
    console.error("Error saving report:", error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
