# Deutsche Pterodactyl-Sprachpakete

Dieses unabhängige Projekt ergänzt Pterodactyl Panel 1.15.0 um Englisch,
Standarddeutsch, Schwäbisch und Bayrisch. Die Übersetzung wird auf Quellcodeebene
eingebaut; es gibt keine Laufzeitübersetzung, keine externen Übersetzungsdienste
und keine DOM-Manipulation.

Der Patch ist absichtlich exakt an Panel 1.15.0 gebunden. Unbekannte
Quellcodestände und Verzeichnisse mit einer produktiven `.env` werden
abgewiesen.

## Umfang

- Benutzeroberfläche und Administration
- Dialoge, Untermenüs, Formulare, Hilfetexte und Berechtigungen
- dauerhaft gespeicherte Sprachauswahl mit CSRF-Schutz
- geprüfte regionale Kurztexte für Schwäbisch und Bayrisch

Nicht übersetzt werden Laufzeitdaten wie Servernamen, Konsolenausgaben,
Dateinamen, Befehle, Egg-Inhalte, Pfade oder API-Daten.

## Bauen

```bash
npm ci
./scripts/build-release.sh /pfad/zu/panel.tar.gz dist/panel-1.15.0-localized.tar.zst
```

Das offizielle `panel.tar.gz` muss aus dem
[Pterodactyl-Release 1.15.0](https://github.com/pterodactyl/panel/releases/tag/v1.15.0)
stammen. Prüfsumme, Quellcodeabdeckung, Tests und Produktions-Build werden
automatisch geprüft.

Vor einer Installation unbedingt [INSTALL.md](docs/INSTALL.md) lesen und eine
Datenbank- sowie Dateisicherung anlegen.
