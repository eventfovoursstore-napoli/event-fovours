# EVENT FAVOURS — shop e anteprima

## Anteprima locale

Apri `http://127.0.0.1:8000/index.html` per la vetrina e `http://127.0.0.1:8000/admin.html` per la gestione. Nell’anteprima locale puoi aggiornare i testi, caricare foto, creare prodotti e prezzi. I dati restano nel browser di questo computer.

La pagina principale mostra le quattro foto inviate in una galleria con dissolvenza, zoom leggero, comandi e indicatori. Il catalogo parte vuoto: aggiungi i prodotti dal pannello. Per la versione online le modifiche al catalogo vanno effettuate da admin dopo aver attivato e autorizzato l’account amministratore.

## Ordini e pagamenti

Il sito non incassa pagamenti online. L’utente prepara una richiesta d’ordine; il prezzo finale, la disponibilità, il metodo di pagamento e la spedizione in Italia si concordano direttamente con il negozio. Il pulsante apre una bozza WhatsApp da controllare e inviare. Il numero Business è ancora da collegare nella configurazione pubblica del sito.

## Account e newsletter

I clienti possono registrarsi con email e password Supabase. Il consenso promozionale è facoltativo e separato. L’iscrizione deve essere disattivata su richiesta; l’interfaccia account consente di disiscriversi. L’invio delle campagne richiede un servizio email e le credenziali server configurate in sicurezza; non inviare campagne finché non sono stati completati mittente, lista e revisione privacy.

## Informative legali

`privacy.html`, `condizioni.html` e `recesso.html` sono bozze generiche. Contengono campi segnaposto per titolare, indirizzo, dati fiscali, contatti e periodi di conservazione. Vanno completati e verificati prima di accettare ordini. Il diritto di recesso può avere eccezioni per beni su misura o chiaramente personalizzati nei limiti di legge; la valutazione dipende dal singolo prodotto e dal contratto.

## File principali

- `index.html` — vetrina, galleria, account e richiesta d’ordine.
- `admin.html` — pannello di amministrazione.
- `privacy.html`, `condizioni.html`, `recesso.html` — informative generiche da completare.
- `assets/` — logo e foto della vetrina.
- `supabase-config.js` — solo URL e chiave publishable pubblica; contiene anche il numero WhatsApp quando sarà fornito.
- `supabase-event-favours-setup.sql` — configurazione iniziale shop e storage.
- `supabase-commerce-setup.sql` — riferimento completo dello schema Commerce; la versione online usa solo account e newsletter necessari.

Non inserire password o chiavi secret in questi file. La chiave secret condivisa in precedenza va revocata/ruotata in Supabase; usa nel sito esclusivamente la chiave publishable.
