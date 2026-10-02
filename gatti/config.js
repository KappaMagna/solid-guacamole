// ─────────────────────────────────────────────────────────────
//  CONFIGURAZIONE — leggi LEGGIMI.md per i passaggi completi
// ─────────────────────────────────────────────────────────────
//
// 1) Incolla qui l'oggetto "firebaseConfig" che Firebase ti mostra
//    quando registri l'app web (Impostazioni progetto → Le tue app).
//    Finché resta null, l'app funziona in "modalità prova": i dati
//    restano solo sul telefono che stai usando.
//
// Esempio:
// export const firebaseConfig = {
//   apiKey: "AIza...",
//   authDomain: "pimpi-oberon.firebaseapp.com",
//   projectId: "pimpi-oberon",
//   storageBucket: "pimpi-oberon.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef"
// };
export const firebaseConfig = {
  apiKey: "AIzaSyDVJRFSy6PJ44zy_ICMXtqUQBwBIVGCZLo",
  authDomain: "pimpi-obi.firebaseapp.com",
  projectId: "pimpi-obi",
  storageBucket: "pimpi-obi.firebasestorage.app",
  messagingSenderId: "697895571788",
  appId: "1:697895571788:web:57a45e409c28afa98f7fe9",
};

// 2) I nomi di chi usa l'app. Al primo accesso ognuno sceglie il proprio
//    sul suo telefono (si può cambiare da ⚙️), e accanto a ogni spesa
//    compare il nome di chi l'ha inserita. L'account può essere uno solo.
export const nomi = ["Kerstin", "Enrico"];
