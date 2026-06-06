# Autocode: Review-Findings automatisch umsetzen (Review→Fix-Loop)

> Implementierungs-Spezifikation für einen Agenten. Beschreibt, wie der
> Review-Pass von einem reinen Log-Output zu einem geschlossenen
> Review→Fix-Kreislauf ausgebaut wird.

## Context

Autocode (`autocode/`) implementiert GitHub-PRD-Issues end-to-end und fährt als
letzten Schritt einen **Review-Pass** über den vollen `main...HEAD`-Diff
(`runReviewPhase`, `autocode/src/runner.ts:103`). Heute wird dessen Ergebnis nur
nach stdout gestreamt (`createStreamRenderer`) und danach der Worktree
aufgeräumt — **mit dem Report passiert nichts**. Der Review-Agent benennt also
Verbesserungen, die niemand umsetzt.

Ziel: Alles, was der Review als Verbesserung erkennt, soll umgesetzt werden —
und zwar **mit frischem Kontext pro Verbesserung**. Das Grundprinzip „frischer
Subprozess pro Arbeitseinheit" existiert in Autocode bereits
(`runImplementationPhase` startet pro Sub-Issue einen eigenen `claude`-Prozess).
Wir hängen den Review an dieselbe Maschinerie: Review-Findings werden zu
vollwertigen PRD-Sub-Issues, die im selben Lauf von je einem frischen Agenten
gefixt werden, bis der Review sauber ist oder ein Rundenlimit greift.

## Entscheidungen

1. **Wann/wo gefixt wird:** Im selben Lauf, selber `feat/`-Branch. Ergebnis
   bleibt „ein Branch, fertig zum Pushen". Issues sind Träger + Nachvollziehbarkeit.
2. **Wie Findings zu Issues werden:** Der Review-Agent gibt **strukturiertes
   JSON** aus; der TS-Orchestrator legt die Issues via Octokit an. GitHub-
   Mutationen bleiben im Orchestrator (wie `closeIssue` heute) — deterministisch,
   testbar, keine Seiteneffekte im Agenten.
3. **Umfang / Entkopplung:** Autocode ist **nicht** an die Sektionen von
   `review.md` gekoppelt. `review.md` darf sich frei ändern; der **einzige
   stabile Vertrag** ist die `findings[]`-Liste. Der Orchestrator ist „dumm":
   jedes Finding → ein Issue → umsetzen. Das Verdict ist kein Steuersignal mehr —
   leeres `findings[]` = „nichts zu tun".
4. **Terminierung:** Bounded Re-Review-Loop. Nach dem Fixen erneut reviewen, bis
   `findings[]` leer ist oder das Rundenlimit erreicht ist.
5. **Rundenlimit:** Default **3**, konfigurierbar über `AUTOCODE_REVIEW_MAX_ROUNDS`
   (`.env`) und `--review-rounds` (CLI) — exakt das Auflösungsmuster von
   `--model` / `AUTOCODE_MODEL`.
6. **Issue-Form:** Vollwertige PRD-Sub-Issues (`## Parent` → PRD, Label
   `ready-for-agent`, plus backend/frontend-Labels aus dem Finding). Damit
   komponiert `runImplementationPhase` automatisch den richtigen Prompt und ein
   abgestürzter Lauf ist per normalem Re-Run wiederaufnehmbar.
7. **Rest-Findings bei Limit:** Werden als **offene** Sub-Issues stehengelassen
   (nicht im Lauf gefixt) + Klartext-Summary im Log. Ein späterer
   `agent run --issue <PRD>` nimmt sie automatisch über die bestehende
   Eligibility-/Topo-Maschinerie auf.

## Der stabile Vertrag: `findings[]`

**`review.md` bleibt unangetastet** — es beschreibt nur, *wie* der Review-Agent
arbeitet. Der Maschinen-Vertrag lebt als Konstante `REVIEW_OUTPUT_CONTRACT`
**im Code** (`runner.ts`, direkt neben `parseFindings`) und wird zur Laufzeit an
den Review-System-Prompt angehängt — genauso, wie `runImplementationPhase` heute
`basic.md` + `backend.md` komponiert. So kann der Vertrag nicht in einer
kuratierbaren Markdown-Datei „vergessen" werden, und er ist mit dem Parser
versioniert: ändert sich das Schema, ändern sich Vertrag und Parser in derselben
Datei.

Der angehängte Vertrag instruiert: Gib nach dem Report **als Letztes** genau
einen ```json-Block aus. Schema:

```json
{
  "findings": [
    {
      "title": "Imperativer Kurztitel der Verbesserung",
      "body": "Was ist falsch, wo (file:symbol), was der Fix erreichen muss.\n\n## Acceptance criteria\n- [ ] konkretes, testbares Kriterium\n- [ ] ggf. negativer/Boundary-Test",
      "labels": ["backend"]
    }
  ]
}
```

- `labels` ist eine (optionale) Teilmenge von `["backend","frontend"]` — reine
  Prompt-Komposition-Hints. Der Orchestrator ergänzt `ready-for-agent` selbst.
- `body` enthält bereits `## Acceptance criteria`-Checkboxen (die TDD-Red-Phase
  in `basic.md` keyt darauf). `## Parent` / `## Blocked by` schreibt der
  Orchestrator, **nicht** der Agent.
- Sauberer Review → `{"findings": []}`.

## Änderungen

### 1. `prompts/review.md` — **keine Änderung**
Bleibt die reine „wie reviewe ich"-Anleitung. Der Output-Vertrag wird nicht hier
abgelegt (siehe `REVIEW_OUTPUT_CONTRACT` in `runner.ts`), damit er nicht durch
spätere Umformulierungen der Markdown-Datei verlorengeht.

### 2. `src/stream.ts` — finalen Text nach außen reichen
- `StreamRenderer` um einen Getter erweitern, z.B. `result(): string`, der das
  bereits gesammelte `finalText` (`stream.ts:124-133`) zurückgibt. Rendering
  bleibt unverändert.

### 3. `src/runner.ts`
- `runClaude(...)` gibt `Promise<string>` zurück (das `renderer.result()` nach
  `finish()`), statt `void`.
- **Neu** Konstante `REVIEW_OUTPUT_CONTRACT` (String): der Maschinen-Vertrag
  (JSON-Schema + „als Letztes genau ein ```json-Block; jede umsetzbare
  Verbesserung = ein finding mit testbaren Acceptance-Criteria; nichts zu tun =
  `{"findings": []}`; Scope-Creep darf als Finding auftauchen"). Wird in
  `runReviewPhase` an `review.md` angehängt: `systemPrompt = reviewMd + "\n\n" +
  REVIEW_OUTPUT_CONTRACT`.
- **Neu** `parseFindings(text: string): Finding[]` (rein, testbar): extrahiert
  den **letzten** ```json-Fence, `JSON.parse`, validiert `findings[]` (Array,
  jedes Element mit nicht-leerem `title`/`body`, `labels` auf bekannte Werte
  gefiltert). Bei fehlendem/kaputtem Block: **leeres Array + Warnung** (den schon
  geleisteten Lauf nicht crashen). `Finding`-Typ exportieren.
- `runReviewPhase(...)` gibt `Promise<Finding[]>` zurück (= `parseFindings` auf
  den eingefangenen Text).
- `commitAll`-Aufruf für Fixes nutzt Präfix `fix:` statt `feat:`
  (`fix: <title> (closes #N)`), analog zur bestehenden Implementierungsphase.

### 4. `src/github.ts` — Issue-Erzeugung (neu)
- **Neu** `createSubIssue(cfg, { prdNumber, title, body, labels })` →
  `Promise<number>`. Baut den Body als
  `<finding.body>\n\n## Parent\n#<prd>\n\n## Blocked by\nNone` und legt das Issue
  via Octokit (`client.issues.create`) mit Labels `["ready-for-agent", ...labels]`
  an. Gibt die neue Issue-Nummer zurück. (Octokit ist schon im Einsatz; passt
  besser als `gh` für den Rückgabewert.)

### 5. `src/index.ts` — Single-Review durch Loop ersetzen
Ersetzt den Block `autocode/src/index.ts:127-129`. Modell-Auflösung um die
Runden erweitern (`opts.reviewRounds ?? AUTOCODE_REVIEW_MAX_ROUNDS ?? 3`), neue
CLI-Option `--review-rounds <n>`.

Schleifen-Semantik (`maxRounds` = max. Review-Pässe, Default 3):

```
for (let round = 1; ; round++) {
  const findings = await runReviewPhase(prd, diffAgainst("main"), model);
  if (findings.length === 0) { log("review clean — nothing to fix"); break; }

  // Findings IMMER als offene Sub-Issues persistieren (Träger + Resilienz).
  const created = [];
  for (const f of findings) {
    const n = await createSubIssue(cfg, { prdNumber: prd.number, ...f });
    created.push({ ...f, number: n });
  }

  if (round >= maxRounds) {
    // Limit erreicht: NICHT mehr fixen, offen lassen.
    log(`max review rounds (${maxRounds}) reached — ` +
        `${created.length} finding(s) left as open issues: ${nums}. ` +
        `Re-run 'agent run --issue ${prd.number}' to pick them up.`);
    break;
  }

  // Unter Limit: jedes Finding mit frischem Subprozess fixen, committen, schließen.
  for (const issue of created) {
    const sub = { number: issue.number, title: issue.title,
                  body: issue.body, labels: issue.labels ?? [], blockedBy: [] };
    await runImplementationPhase(sub, model);          // frischer Kontext
    const sha = commitAll(`fix: ${issue.title} (closes #${issue.number})`);
    closeIssue(`${cfg.owner}/${cfg.repo}`, issue.number, branch, sha);
  }
}
```

- Die in der **letzten** (capped) Runde gefundenen Findings bleiben so als offene
  `ready-for-agent`-Sub-Issues stehen — exakt das gewünschte Überlauf-Verhalten.
- Der `finally`-Block (`cleanupWorktree`) bleibt; der ganze Loop läuft innerhalb
  des bestehenden `try`.
- `--dry-run` bleibt unberührt (Loop läuft erst nach Worktree-Erstellung).
- `runImplementationPhase` braucht keine Änderung: es liest `issue.labels` für
  backend/frontend, die wir aus dem Finding durchreichen.

### 6. Doku & Config
- `autocode/.env.example`: `AUTOCODE_REVIEW_MAX_ROUNDS=3` mit Kommentar.
- `autocode/README.md`: Schritt 6 der Ablaufbeschreibung (Zeilen ~221-222) von
  „Report wird gedruckt" auf den Review→Fix-Loop aktualisieren; neue
  Env/CLI-Option dokumentieren; klarstellen, dass Rest-Findings als offene
  Issues zurückbleiben.

## ADR (empfohlen)

Eine Entscheidung hier ist ADR-würdig (schwer reversibel, ohne Kontext
überraschend, echtes Trade-off): **„Review-Findings werden zu PRD-Sub-Issues und
im selben Lauf über einen bounded Re-Review-Loop gefixt; der `findings[]`-JSON-
Block ist der stabile Vertrag, der Autocode von den Review-Sektionen entkoppelt."**
Vorschlag: `docs/adr/0007-autocode-review-fix-loop.md` (nächste freie Nummer nach
0006). Festhalten: Alternativen (deferred Re-Run vs. same-run; Agent-`gh` vs.
TS-Octokit; section-coupled vs. findings-contract) und warum same-run +
TS-Mutationen + entkoppelter Vertrag gewählt wurden.

> Hinweis: `CONTEXT.md` (Wurzel) ist das **Produkt**-Glossar von Siegmund.
> Autocode ist Dev-Tooling und gehört dort fachlich nicht hinein — keine
> Glossar-Änderung nötig.

## Verifikation

1. **Unit:** Tests für `parseFindings` (gültiger Block, fehlender Block, kaputtes
   JSON → `[]`+Warn, `labels`-Filter, leeres `findings`). Test-Setup orientiert
   sich an `autocode/src/eligibility.test.ts`.
   Lauf: `cd autocode && npm test` (bzw. das in `package.json` definierte Skript).
2. **Build:** `cd autocode && npm run build` (TS muss durch die geänderten
   Signaturen sauber kompilieren).
3. **Dry-run unverändert:** `docker compose run --rm autocode agent run --issue <PRD> --dry-run`
   bricht weiterhin vor Worktree-Erstellung ab — Loop darf nicht greifen.
4. **End-to-end** gegen eine kleine Test-PRD mit absichtlich schwacher
   Implementierung: `docker compose run --rm autocode agent run --issue <PRD> --review-rounds 2`.
   Erwartung: Review legt Fix-Issues an, frische Subprozesse fixen sie,
   `fix:`-Commits erscheinen auf dem Branch, Issues werden geschlossen; bei
   Nicht-Konvergenz bleiben offene `ready-for-agent`-Issues + Summary im Log.
   Auf dem Host prüfen: `git log --oneline feat/<PRD>-...`,
   `gh issue list --label ready-for-agent`.
