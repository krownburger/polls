# polls

Poll-værktøj: opret en poll med navngivne kolonner (Ja/Nej ✓/✗, antal via dropdown eller fritekst), del et link, og se alle svar samlet.

## Kør det

1. Sørg for at Node.js er installeret.
2. Kør `node server.js` i denne mappe.
3. Åbn http://localhost:3000 – opret poll'en på `index.html` og del det genererede link (`svar.html?id=...`).

På `index.html` kan du også sætte teksten i navn-popup'en (f.eks. "Skriv dit barns navn") og gå til `admin.html` for et overblik over alle polls – med svar-antal, link og mulighed for at slette.

Svar gemmes i `data.json` på serveren, så alle der åbner linket kan se hinandens svar.

Hvis du åbner `index.html` direkte som fil (uden serveren), virker et statisk fallback-link hvor svar kun gemmes i den enkelte browser.

## Host med Docker

1. Sørg for at Docker og Docker Compose er installeret.
2. Kør `docker compose up -d --build` i denne mappe.
3. App'en kører på http://localhost:3000 – data (polls og svar) gemmes i `./data/data.json`, så de overlever genstarter af containeren.
