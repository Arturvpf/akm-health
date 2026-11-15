# AKM-34 — Hypothetical scenario comparator

The `#/scenarios` page contrasts the **frozen, synthetic** state of ODYSSEY-26's second night (file `backend/app/seed.py`) with alternative values typed by the operator. It supports the five official MVP indicators: sleep (h), single heart-rate reading (bpm), ordinal mood (1–5), cabin CO₂ (ppm) and cabin temperature (°C).

### Assumptions and provenance

- Aurora/A1: sleep 5.4 h, HR 74 bpm, mood 3; Orion/A2: sleep 5.7 h, HR 71 bpm, mood 3; Vega/A3: sleep 5.6 h, HR 76 bpm, mood **absent**; Lyra/A4: sleep 7.9 h, HR **absent**, mood 4.
- Latest synthetic cabin: CO₂ 980 ppm, temperature 22.2 °C. This is neither NASA telemetry nor an outside-Mars measurement.
- Alternatives are local inputs; they are not saved to the database and do not trigger rules. The calculation is simply `hypothesis – reference` with the matching unit.
- A value that is unmeasured or out of domain yields an explicit absence of comparison. There is no risk/benefit classification and no medical prediction.

### Verifiable acceptance criteria

1. The page identifies both scenarios and the synthetic origin.
2. Changing a value shows only the arithmetic difference; it produces no alerts or recommendations.
3. A3/mood and A4/HR are not filled with zero or invented values.
4. Invalid and non-finite inputs produce no fictitious differences.
5. The hypothetical environment can be selected (AKM-35), but the comparator does not modify the stored mission.

NASA contextual references: https://www.nasa.gov/hrp/hazards/ and https://www.nasa.gov/hrp/risks/ . Scientific relevance does not mean clinical validation of these demonstration numbers.
