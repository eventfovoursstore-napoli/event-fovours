# Attivare le notifiche push

Il database e le funzioni Supabase sono già predisposti. Per inviare notifiche reali occorrono le chiavi VAPID, conservate solo nei secret delle Edge Functions.

1. Genera una coppia di chiavi VAPID con uno strumento affidabile.
2. Nel progetto Supabase apri **Edge Functions → Secrets** e aggiungi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` con valore `mailto:eventfovours.store@gmail.com`.
3. Non copiare mai la chiave privata in GitHub, nel sito o in un messaggio.
4. Apri il sito dal telefono, tocca **Attiva notifiche** e consenti. Nell’admin seleziona **Invia una notifica ai clienti** quando aggiungi un prodotto visibile.

Il browser chiede il consenso solo dopo che la persona tocca il pulsante. La disiscrizione è disponibile dallo stesso riquadro.
