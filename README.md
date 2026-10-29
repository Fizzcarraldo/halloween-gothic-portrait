# American Gothic — reagierendes Porträt (Halloween-Gag)

Ein Gemälde im Goldrahmen, das per Webcam merkt, ob jemand davorsteht und lächelt,
und dann den Gesichtsausdruck wechselt. Gedacht als Party-Gag: ein bekanntes Gesicht
(z. B. der #OPENTOWORK-Kumpel) als mürrisches American-Gothic-Gemälde, das jeden
missbilligend anschaut, der es anlächelt.

## Starten

Webcam braucht einen "sicheren Kontext", also **über http(s) oder localhost**, nicht
als Datei öffnen. Einfachster Weg:

```
cd ~/Projekte/halloween-gothic-portrait
python3 -m http.server 8080
```

Dann im Browser: http://localhost:8080  → auf "Porträt erwecken" klicken, Kamera erlauben.

Für die Party auf dem Anzeige-Gerät am besten **Vollbild** (F11 / Safari: ⌃⌘F).

## Deine Bilder einsetzen

Leg drei Bilder in `assets/` (das Porträt in drei Ausdrücken):

| Datei | Zustand |
|---|---|
Alle Zustände stehen in `app.js` unter `STATES` (Quelle der Wahrheit). Pro Zustand ein
Bild `assets/<state>.jpg`; fehlt eins, zeigt es einen Platzhalter (Emoji + Label):

| Datei | ausgelöst durch |
|---|---|
| `assets/stern.jpg`  | niemand da (Standard) |
| `assets/notice.jpg` | da, aber keine Grimasse |
| `assets/scowl.jpg`  | **Lächeln** |
| `assets/tongue.jpg` | **Zunge raus** |
| `assets/shock.jpg`  | **Mund weit auf** (Schock/Gähnen) |
| `assets/kiss.jpg`   | **Kussmund** (Lippen spitzen) |
| `assets/cheeks.jpg` | **Backen aufblasen** |
| `assets/wink.jpg`   | **Zwinkern** (ein Auge zu) |
| `assets/wide.jpg`   | **Augen aufreißen** |
| `assets/brows.jpg`  | **Augenbrauen hochziehen** |
| `assets/angry.jpg`  | **Stirn runzeln** (finster) |
| `assets/sneer.jpg`  | **Nase rümpfen** (Ekel) |
| `assets/sad.jpg`    | **Mundwinkel runter** (traurig) |
| `assets/smirk.jpg`  | **Mund zur Seite** (schief grinsen) |

**Weniger ist oft mehr:** du musst nicht 14 Bilder malen. Für den Gag reichen oft 3-4
starke (stern / scowl / tongue / shock). Zustände, die du nicht willst, einfach in `STATES`
**und** `GESTURES` auskommentieren, der Rest läuft weiter.

Reihenfolge in `GESTURES` = Priorität (die erste Grimasse über ihrer Schwelle `th` gewinnt;
starke/spezifische stehen oben). Grimassen gibt es nur im MediaPipe-Modus; der
Bewegungs-Fallback kennt nur Anwesenheit. Mit Taste **d** siehst du live, was erkannt wird,
und kannst die `th`-Schwellen justieren (subtile wie `brows`/`sneer`/`sad` triggern leichter).

Optional: `assets/hmpf.mp3` (ein genervtes Geräusch, spielt beim Reagieren).

Ohne Bilder läuft es trotzdem, dann zeigt es Platzhalter (😐 / 👁️ / 😠), damit du
die Mechanik sofort siehst.

### Die American-Gothic-Bilder erzeugen

Foto in ein Bildmodell (Midjourney / SDXL / DALL·E), z. B. Prompt:

> "Oil painting in the style of Grant Wood's American Gothic, portrait of this man,
> stern and dour expression, holding a pitchfork, muted earthy palette, gothic
> farmhouse window behind, 1930s regionalist style"

Dreimal mit leicht anderem Gesichtsausdruck (neutral / aufmerksam / finster) oder
das neutrale Bild nehmen und die anderen beiden daraus ableiten.

## Tuning

Oben in `app.js` unter `CFG`:
- `smileThreshold` — wie stark gelächelt werden muss (0..1)
- `framesToNotice` / `framesToScowl` / `framesToSleep` — Trägheit der Reaktionen
- `motionThreshold` — Empfindlichkeit im Bewegungs-Fallback

Taste **d** blendet eine Debug-Zeile ein (zeigt Modus + erkannte Werte).

## Wie es reagiert (3 Stufen, automatisch)

1. **MediaPipe FaceLandmarker** (braucht Internet beim Laden): erkennt Gesicht + Lächeln
   → echtes "du lächelst, es schaut finster".
2. **Bewegungserkennung** (offline, kein Download): reagiert auf Anwesenheit/Bewegung
   (ohne Lächeln-Erkennung).
3. **Demo-Modus** (keine Kamera): wechselt die Zustände auf Zeit.

Wenn die Party-Location kein stabiles Internet hat: einmal vorher mit Internet öffnen
(dann ist MediaPipe im Browser-Cache), oder es nutzt automatisch den Bewegungs-Fallback.

## Idee-Twists

- Nicht spiegeln, sondern **urteilen**: Lächeln → finsterer. Der Kontrast ist der Gag.
- Platzierung: Flur / vor dem Klo, wo einzelne Leute vorbeikommen = beste Schreck-Lage.
- Ton macht die halbe Miete (ein "Hmpf" oder Flüstern).
