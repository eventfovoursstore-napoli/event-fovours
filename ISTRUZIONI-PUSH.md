# Attivare notifiche e login Facebook

## Notifiche push

Il database e le funzioni Supabase sono già predisposti. Per inviare notifiche reali serve una coppia di chiavi VAPID.

1. Sul computer apri PowerShell e genera le chiavi con:
   `npx --yes web-push@3.6.7 generate-vapid-keys`
2. Nel progetto Supabase apri **Edge Functions → Secrets** e aggiungi:
   - `VAPID_PUBLIC_KEY`: valore **Public Key** generato
   - `VAPID_PRIVATE_KEY`: valore **Private Key** generato
   - `VAPID_SUBJECT`: `mailto:eventfovours.store@gmail.com`
3. Salva i secret. Non copiare mai la chiave privata in GitHub, nel sito o in un messaggio.
4. Apri il sito dal telefono, tocca **Attiva notifiche** e consenti. Nell’admin seleziona **Invia una notifica ai clienti** quando aggiungi un prodotto visibile.

Il browser chiede il consenso solo dopo che la persona tocca il pulsante. La disiscrizione è disponibile dallo stesso riquadro. Le chiavi push sono specifiche di questa applicazione e non sono credenziali Supabase.

## Login Facebook

1. Crea un’app Facebook in Meta for Developers e aggiungi il prodotto **Facebook Login**.
2. Come URL di callback OAuth usa:
   `https://ithmcqkoxficjtaqvgkg.supabase.co/auth/v1/callback`
3. In Supabase apri **Authentication → Sign In / Providers → Facebook**, attiva il provider e inserisci App ID e App Secret.
4. In **Authentication → URL Configuration**, aggiungi fra gli URL di reindirizzamento:
   `https://eventfovoursstore-napoli.github.io/event-fovours/`
5. Per permettere l’accesso a tutti i clienti, porta l’app Meta in modalità Live e completa gli eventuali controlli richiesti da Meta.

Instagram non è un provider social integrato direttamente da Supabase Auth. Il pulsante Facebook non autentica un account Instagram. L’accesso Instagram richiede un’integrazione Meta separata e le credenziali di un’app Meta.
