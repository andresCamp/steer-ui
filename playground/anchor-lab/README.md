# anchor lab

An experiment, not a feature. It answers one question before any page-annotation
code gets written: **when a page note is captured against an element, can it find
that element again after the page changes?**

Run it with `pnpm dev:anchor` (port 5399) and press *Run all scenarios*.

## Method

Eight notes are captured against a baseline page. The page is then mutated
twenty-three ways, and seven resolution strategies are asked to find each note's
element again. That is 1,288 scored resolutions.

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
  which is worse than either, and a direct violation of invariant 4
  (degrade visibly, never crash)

Six of the twenty-three scenarios are **held out**: they were written after the
winning strategy was tuned, and aimed at the evidence that strategy leans on.

## Results

| strategy | correct | orphaned | wrong |
| --- | --- | --- | --- |
| page coords | 72% | 5% | **23%** |
| nth-of-type path | 91% | 7% | 2% |
| stable selector | 90% | 8% | 2% |
| source exact | 72% | 26% | 3% |
| source fuzzy | 85% | 0% | **15%** |
| layered v1 | 92% | 0% | 8% |
| **layered v2** | **97%** | 3% | **0%** |

## What the experiment established

1. **Layout change is the easy case, not the hard one.** Resize, dark theme,
   longer copy, scroll and font scaling produced zero failures for any
   DOM-aware strategy. The worry that motivated the lab is the least dangerous
   thing in it.

2. **Absolute coordinates are unusable.** Mean placement drift was 42px and peaked
   at 572px. Coordinates stored as fractions of the element's own box drift by
   zero, by construction. Placement is a solved problem the moment
   re-identification works.

3. **Exact source-location matching fails on the first edit.** A `+3` line shift
   orphaned every note. So did a pure column shift, which is what running
   Prettier does. Line numbers are not durable; the file path is.

4. **A confident matcher is worse than a dumb one.** Source-fuzzy scored more
   correct answers than nth-of-type path and was still the worse strategy,
   because it never refused to answer. Every deleted element produced a
   plausible wrong match.

5. **Content decides, source narrows.** The winning resolver uses the file path
   to bound the candidate set and the line number only as a tiebreak, then
   ranks on the element's own text and the text of its nearest distinguishing
   ancestor. That ancestor context is what tells three identical `Manage`
   buttons apart.

6. **Refusing to answer is a feature.** Two gates make v2 orphan rather than
   guess: the element must still roughly say what it said, and when several
   candidates say the same thing their surroundings must agree too. Those gates
   are the entire difference between 8% wrong and 0% wrong.

## Known limits

- v2's six orphans are all cases where the copy was genuinely rewritten. That is
  arguably correct behaviour rather than a failure, but it means notes on
  text-free elements (icons, spacers, inputs without a `data-testid`) fall
  through to the structural path.
- Every note is resolved independently. Since a file's locs all shift by the
  same amount, resolving a route's notes together would let the confident
  matches estimate that offset and rescue the ambiguous ones. Not implemented.
- The transform itself is simulated. Emitting `data-steer-loc` is settled
  practice (`lovable-tagger`, `vite-plugin-component-debugger`, TanStack
  Devtools), so the lab isolates the anchoring question from it deliberately.
