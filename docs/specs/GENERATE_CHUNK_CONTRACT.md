# Generate Chunk Contract

This document is the canonical pre-implementation contract for sentence generation in CHUNKS Lesson Generator.

It exists so generation behavior can be version-controlled alongside deploys.

---

## 1. Core purpose

`generateChunk()` must:

> create one meaningful Vietnamese utterance, spoken by one speaker, built from required resources whose combined Ohm expresses the target difficulty; then generate the English sentence as a faithful follow-up translation.

This is not a generic sentence generator.

---

## 2. Canonical generation order

```text
resource set + target difficulty + length
-> infer one speaker situation
-> infer one communicative intent
-> write Vietnamese utterance
-> translate to English faithfully
```

### Important

- Vietnamese is the source of truth
- English follows Vietnamese
- dialogue is not allowed

---

## 3. Inputs

### Resources

Resources are mandatory meaning ingredients.
Each resource contributes:

- text
- semantic role
- Ohm
- difficulty signal

The final Vietnamese utterance must integrate them meaningfully.

### Ohm

In this flow, **Ohm = difficulty**.

The mixer chooses resources based on target Ohm, and generation must preserve that difficulty signal in the final sentence.

### Length

Canonical rule:

- hard word-count limit applies to **Vietnamese output only**
- English is downstream and should remain proportionate, but Vietnamese is the enforced length target

---

## 4. Output contract

Required:

- `vieSentence`
- `engSentence`

Optional:

- `category`
- `evaluation`

Recommended schema:

```json
{
  "vieSentence": "...",
  "engSentence": "...",
  "category": "optional",
  "evaluation": "optional internal reasoning summary"
}
```

---

## 5. Meaning contract

A valid generated sentence must be:

### One-speaker

- one speaker only
- no dialogue
- no turn-taking

### One-idea

The utterance must have one clear communicative center:

- reaction
- reflection
- explanation
- memory
- advice
- confession
- observation

### One situation

The sentence must feel like it comes from a lived micro-situation.

### Resource-grounded

Resources must matter semantically, not just appear on the surface.

---

## 6. Hard implementation rules

1. Generate Vietnamese first.
2. English must follow Vietnamese faithfully.
3. No dialogue.
4. Validate Vietnamese word count in code.
5. Validate Vietnamese sentence count in code.
6. Validate resource grounding in code.
7. Reject malformed JSON.

---

## 7. Prompt requirements

The prompt used by `generateChunk()` should explicitly require:

- one-speaker Vietnamese utterance
- one clear communicative intent
- meaningful use of all required resources
- Vietnamese length compliance
- English fidelity

The prompt should explicitly forbid:

- list-like stitching
- generic filler
- second speaker
- semantic drift in English

---

## 8. Acceptance questions

Before accepting generated output, the system should be able to answer:

1. Is this a one-speaker utterance?
2. Does the Vietnamese sentence have one real idea?
3. Are the required resources meaningfully integrated?
4. Does the sentence feel compatible with selected difficulty?
5. Is the Vietnamese length valid?
6. Is the English translation faithful?

---

## 9. Final canonical sentence

> Generate one meaningful Vietnamese utterance from one speaker, grounded in the required resources and their Ohm-defined difficulty, under the Vietnamese length constraint, then produce a faithful English follow-up translation.
