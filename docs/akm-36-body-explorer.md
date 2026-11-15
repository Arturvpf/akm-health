# AKM-36 — Interactive and accessible human body

Page `#/body`. An **original** schematic SVG, with no clinical anatomical claim, is presented with overlaid native HTML controls and an equivalent text list. The areas have `button`, `aria-label`, `aria-pressed`, visible focus and native support for Tab, Shift+Tab, Enter and Space. The context changes through AKM-35 without fabricating new readings.

| Selected area | Faithful association with P0 indicators | Do not infer |
|---|---|---|
| Head/behavior | `sleep_hours`, self-reported `mood_score` | Brain activity or psychological diagnosis |
| Cardiovascular reference | `heart_rate_bpm` single reading | Heart disease or a causal effect of gravity |
| Muscles and bones | **No P0 indicator** | Measured bone mass or muscle loss |
| Habitat | `co2_ppm`, `cabin_temp_c` **outside the body** | Respiratory diagnosis or individual exposure |

Official NASA links to research on isolation, gravity and closed environments are shown in each area. The interface uses text in addition to color and offers an alternative to visual selection on the SVG.

**Sources:** https://www.nasa.gov/hrp/hazards/ ; https://www.nasa.gov/hrp/risks/ ; https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ ; https://www.nasa.gov/hrp/hazard-hostile-closed-environments/ .

**Acceptance criterion:** step through all area controls by keyboard, select with Enter/Space, and verify that the heading, indicators and caveats change without altering the database or building medical interpretations.
