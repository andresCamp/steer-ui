# anchor lab

Two pages, one question: **when a page note is captured against an element, can
it find that element again after the page changes?** Answered before any
page-annotation code gets written.

```
pnpm dev:anchor      # http://localhost:5399
```

| page | what it is |
| --- | --- |
| `/` | a live dashboard with notes on it, resolved by layered v2. Drag the window edge and the notes stay on the thing they were about. Press `c` to add your own. **Shuffle the app** changes the data, the layout and the source line numbers at once. |
| `/matrix.html` | the scored experiment: eight notes, twenty-three mutations, seven strategies, 1,288 resolutions. |

## Method

Each element carries two attribute families, and the split is what makes the
score trustworthy:

| attribute | who reads it |
| --- | --- |
| `data-steer-loc` | the strategies. Exactly what a dev-only JSX transform would emit. |
| `data-truth-id` | only the harness. No strategy reads it, so scoring cannot confirm itself. |

Three outcomes, ranked:

- **correct** found the right element, or honestly returned nothing when the
  element is genuinely gone
- **orphaned** found nothing while the element still exists. A miss, but a
  visible one the operator can act on
- **wrong** confidently returned a different element. A silently misplaced note,
  worse than either, and a direct violation of invariant 4 (degrade visibly)

Six of the twenty-three scenarios are **held out**: written after layered v2 was
tuned, and aimed squarely at the evidence it leans on (a duplicated identical
card grid, relabelled buttons, rewritten card copy, a renamed row).

## Results

| strategy | correct | orphaned | wrong |
| --- | --- | --- | --- |
| page coords | 72% | 5% | **23%** |
| nth-of-type path | 91% | 7% | 2% |
| stable selector | 90% | 8% | 2% |
| source exact | 72% | 26% | 3% |
| source fuzzy | 85% | 0% | **15%** |
| layered v1 | 92% | 0% | 8% |
| **layered v2** | **100%** | 0% | **0%** |

The deletion control still refuses to answer on all eight targets, which is the
guard that keeps 100% from being a scoring artefact.

## What the experiment established

1. **Layout change is the easy case, not the hard one.** Resize, dark theme,
   longer copy, scroll and font scaling produced zero failures for any
   DOM-aware strategy. The worry that motivated the lab is the least dangerous
   thing in it.

2. **Absolute coordinates are unusable.** Mean placement drift was 42px, peaking
   at 572px. Coordinates stored as fractions of the element's own box drift by
   zero, by construction. Placement is solved the moment re-identification is.

3. **Exact source matching dies on the first edit.** A `+3` line shift orphaned
   every note. So did a bare column shift, which is what running Prettier does.
   The file path is durable; the line number is not.

4. **A confident matcher is worse than a dumb one.** Source-fuzzy scored more
   correct answers than nth-of-type path and was still the worse strategy,
   because it never refused to answer. Every deleted element got a lookalike.

5. **Content decides, source narrows.** The file bounds the candidate set, the
   line is only a tiebreak, and ranking runs on the element's own text plus the
   text of its nearest distinguishing ancestor. That ancestor context is what
   tells three identical `Manage` buttons apart. Nothing else did.

6. **Content is the wrong signal for live data.** A KPI going from `$412,880` to
   `$438,110` is the same element, not a new one, and a dashboard is mostly such
   elements. Content matching alone orphaned three of five notes on the demo
   page after a data refresh.

7. **Structure rescues those, but only under a guard.** When content evidence
   fails, layered v2 falls back to loc group plus occurrence, tag and child
   index. The guard is `siblingCount`: an occurrence index is only meaningful
   while the set it indexes into is intact, so if a row was added or a card
   deleted the tier declines instead of guessing. Uniqueness is required too.
   This tier took the held-out orphans to zero without adding a single wrong
   answer.

8. **Refusing to answer is a feature, not a shortfall.** Two content gates plus
   the sibling-count guard are the entire difference between 8% wrong and 0%.

## Known limits

- Notes on text-free elements (icons, spacers, inputs with no `data-testid`)
  have no content evidence and depend entirely on the structural tier.
- Every note resolves independently. Since a file's locs all shift by the same
  amount, resolving a route's notes together would let the confident matches
  estimate that offset and rescue the ambiguous ones. Not implemented.
- The transform is simulated. Emitting `data-steer-loc` is settled practice
  (`lovable-tagger`, `vite-plugin-component-debugger`, TanStack Devtools), so
  the lab isolates the anchoring question from it deliberately.
