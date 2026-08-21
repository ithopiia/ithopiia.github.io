window.CONFIG = {
  firebase: {
    apiKey: "AIzaSyB-I_C6DKdxDQ2nUlcuLnlwsQoW9sonE_8",
    authDomain: "ithopiia-6e31c.firebaseapp.com",
    projectId: "ithopiia-6e31c",
    storageBucket: "ithopiia-6e31c.firebasestorage.app",
    messagingSenderId: "473948740592",
    appId: "1:473948740592:web:fa69e2eb4b763e249d1b35",
    measurementId: "G-VRL274HEH4"
  },
  useFirebase: true,
  adminEmails: ['admin@ithopiia.com', 'admin@hthopiia.com'],
  storageKey: 'ithopiia_data',
  pointsPerDay: 0,
  countdownHours: 24,
  rooms: ['Shadow', 'Panto'],
  roomDifficulties: { Shadow: 'Medium', Panto: 'Medium' },
}

window.CONFIG.apiBaseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://counter-endorsement-margin-dream.trycloudflare.com/api'
