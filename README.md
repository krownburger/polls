# polls

Poll-værktøj: opret en poll med navngivne kolonner (Ja/Nej ✓/✗ eller fritekst), del et link, og se alle svar samlet.

## Kør det

1. Sørg for at Node.js er installeret.
2. Kør `node server.js` i denne mappe.
3. Åbn http://localhost:3000 – opret poll'en på `index.html` og del det genererede link (`svar.html?id=...`).

Svar gemmes i `data.json` på serveren, så alle der åbner linket kan se hinandens svar.

Hvis du åbner `index.html` direkte som fil (uden serveren), virker et statisk fallback-link hvor svar kun gemmes i den enkelte browser.
