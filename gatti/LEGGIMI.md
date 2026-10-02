# 🐈‍⬛ Pimpi & Oberon: il diario delle spese feline

Una piccola app per segnare quanto spendete per Pimpinella e Oberon (crocchette, umido, snack, lettiera, salute, giochi…) e vedere totali e grafici per il periodo che preferite.

- **Dove si apre:** https://kappamagna.github.io/solid-guacamole/gatti/
- **Costo:** zero. GitHub Pages è gratis e Firebase è sul piano *Spark* gratuito, senza carta di credito.
- **Condivisione:** tu e il tuo compagno entrate con la vostra email e vedete gli stessi dati in tempo reale.

Finché non completi i passaggi qui sotto, l'app funziona in **modalità prova**: salva i dati solo sul telefono che stai usando. Dall'ingranaggio ⚙️ puoi caricare dei dati di esempio per vedere come funziona.

---

## Configurazione (circa 15 minuti, da fare una volta sola)

Conviene farla da computer.

### 1. Crea il progetto Firebase
1. Vai su https://console.firebase.google.com ed entra con il tuo account Google.
2. Clicca **Crea un progetto** e chiamalo per esempio `pimpi-oberon`.
3. Google Analytics non serve: puoi disattivarlo.
4. Il progetto parte sul piano **Spark (gratuito)**. Non attivare il piano Blaze e non inserire carte.

### 2. Attiva l'accesso con email e password
1. Nel menu a sinistra: **Build → Authentication → Inizia**.
2. Nella scheda **Metodo di accesso** scegli **Email/password**, attivalo e salva.
3. Nella scheda **Utenti** clicca **Aggiungi utente** due volte:
   - la tua email e una password (almeno 6 caratteri);
   - l'email del tuo compagno e una sua password, che potrà cambiare in seguito.

Solo questi due account potranno entrare.

### 3. Crea il database
1. **Build → Firestore Database → Crea database**.
2. Posizione: scegli una località europea, per esempio `eur3 (Europe)`.
3. Scegli **Avvia in modalità di produzione**.
4. Apri la scheda **Regole**, cancella tutto e incolla il contenuto del file [`firestore.rules`](firestore.rules).
5. **Importante:** nelle regole sostituisci `TUA.EMAIL@gmail.com` e `EMAIL.COMPAGNO@gmail.com` con le vostre due email, scritte **in minuscolo**. Poi clicca **Pubblica**.

Le regole fanno in modo che solo voi due possiate leggere e scrivere le spese.

### 4. Collega l'app a Firebase
1. Clicca l'ingranaggio accanto a "Panoramica del progetto" e poi **Impostazioni progetto**.
2. In basso, sotto **Le tue app**, clicca l'icona web **`</>`**, dai un nome (per esempio "Pimpi web") e clicca **Registra app**. Firebase Hosting non serve.
3. Firebase ti mostra un blocco `const firebaseConfig = { ... }`. Copia solo la parte tra le graffe.
4. Apri [`config.js`](config.js) e sostituisci `export const firebaseConfig = null;` con:
   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
5. Nello stesso file, in `nomi`, ci sono i nomi tra cui scegliere al primo accesso (adesso `"Kerstin"` ed `"Enrico"`). Ogni spesa mostra il nome di chi l'ha inserita.
6. Salva il file su GitHub. Dopo un paio di minuti GitHub Pages pubblica la nuova versione.

> Le chiavi in `firebaseConfig` non sono segrete: servono solo a dire all'app quale progetto usare. A proteggere i dati sono le **regole del punto 3**, quindi non saltare quel passaggio.

### 5. Installala sul telefono
Aprite il link dell'app sul telefono ed entrate con la vostra email e password.
- **iPhone (Safari):** tasto Condividi → **Aggiungi alla schermata Home**.
- **Android (Chrome):** menu ⋮ → **Installa app** (oppure *Aggiungi a schermata Home*).

Comparirà l'icona con i due mici e l'app si aprirà a schermo intero.

---

## Come si usa

| | |
|---|---|
| **＋** | Aggiungi una spesa: importo, categoria, descrizione e data. I pulsanti di **"Ricompra al volo"** compilano tutto con un tocco. |
| **📊 Riepilogo** | Totale del periodo, media al mese e al giorno, costo a gatto, confronto con il periodo precedente, torta per categoria, barre nel tempo e le 3 spese più costose. |
| **📜 Lista** | Tutte le spese divise per mese. Tocca una spesa per modificarla o eliminarla, oppure 🔁 per ricomprarla oggi. Il filtro mostra una sola categoria e **⬇️ CSV** esporta i dati per Excel o Google Fogli. |
| **Periodo** | Questo mese, mese scorso, 3/6/12 mesi, quest'anno, sempre, oppure **📅 Scegli…** per date a piacere. |

Funziona anche senza connessione: le spese inserite offline vengono inviate appena torna la rete.

## Limiti del piano gratuito
Firebase Spark permette 50.000 letture e 20.000 scritture al giorno. Per due persone e due gatti non c'è rischio di arrivarci.

## File
- `index.html`, `styles.css`, `app.js`: l'app
- `config.js`: la configurazione di Firebase (da compilare)
- `firestore.rules`: le regole di sicurezza da incollare in Firebase
- `manifest.json`, `sw.js`, `icon*`: installazione sul telefono e funzionamento offline
