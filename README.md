# MCDO EET

Eetdagboek (PWA) voor op de iPhone. Gewone HTML/CSS/JS, geen build-stap.
De data staat enkel in de browser van je telefoon (localStorage). Maak af en toe een back-up via Instellingen.

## Online zetten (GitHub Pages, via de website)
1. github.com → **+** (rechtsboven) → **New repository** → naam `mcdo-eet` → **Create repository**.
2. Klik op **uploading an existing file** en sleep de inhoud van deze map erin
   (index.html, manifest.json, icon.png, README.md en de mappen `css` en `js`) → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, map `/ (root)` → **Save**.
4. Na een minuutje: `https://odries.github.io/mcdo-eet/`. Open in Safari → Deel → **Zet op beginscherm**.

Updaten: in de repo **Add file → Upload files**, de gewijzigde bestanden erin slepen, **Commit changes**. Je data blijft staan.

## Koppeling met MCDO PT
In de app: Instellingen → Koppeling met MCDO PT → hetzelfde GitHub-token als in MCDO FIT.
De app zet de laatste 21 dagen in een privé-gist (`mcdo-eet-sync`); MCDO PT leest die met het token dat het al heeft.
