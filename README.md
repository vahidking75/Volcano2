# Volcano: Virtuoso Image Generation Assistance

A modern online prompt creation studio with vocabulary intelligence, model-aware formatting, and cloud-like projects backed by SQLite.

## Features
- **Prompt Studio**: subject + structured modifier blocks, optional weights, negative prompt.
- **Model modes**: Midjourney / SDXL / Flux / DALL·E formatting.
- **Online vocabulary brain** (free APIs):
  - Datamuse multi-search (meaning-like, synonyms, triggers, adjective/noun relations)
  - Dictionary lookup (definitions, phonetics, examples)
  - ConceptNet relationship graph
  - Wikipedia search + summaries
  - Wikidata entity search + attributes (SPARQL)
- **Prompt linter**: contradictions, missing cues, redundancy.
- **Projects**: save/load versions via server-side SQLite (anonymous session cookie).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Notes
- The SQLite database defaults to `./volcano.db`.
- To customize the DB path, set `VOLCANO_DB_PATH`.

