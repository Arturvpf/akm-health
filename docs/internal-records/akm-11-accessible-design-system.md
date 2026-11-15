# AKM-11 · Accessible design system

Task AKM-11 (internal Notion page; Portuguese, not part of the submission) · UX brief (internal Notion page; Portuguese, not part of the submission) · [Alert criteria](../akm-08-alert-safety.md) · [Alert catalog](akm-24-alert-presentation.md)

The tokens in `frontend/src/styles.css` define surfaces, text, semantic colors, focus, typography, spacing and interaction targets. The type scale runs from 0.75 rem to 2.625 rem. Spacing uses multiples of 0.25 rem. Navigation, buttons and the selector have a minimum height of 2.75 rem.

| Component in `frontend/src/design-system.tsx` | Use |
| --- | --- |
| `Card`, `ActionLink`, `SimulationNotice` | Cards, links and the simulation notice on the four routes |
| `Details`, `DataTable`, `SourceBadge`, `QualityBadge` | Units and collection in Register, the scrollable table in History, quality and origin by label |
| `SelectField`, `ActionButton`, `DataState` | Selector with a native label, actions and state messages in the demo |
| `StatusBadge`, `ProtocolLegend` | Experimental classification and legend in Investigation |

Each state communicates meaning through a label and an icon. The icon repeats the text information and is hidden from screen readers. The engine's classifications use green for `normal`, yellow for `attention` and gray for `insufficient_data`. The red of `critical` is reserved for the P0 protocol legend. The result component accepts the three experimental states.

Empty, loading, connection failure and refresh complete are interface states. The feedback region announces these changes and focus returns to the selector after completing or retrying. During loading or a simulated failure, the last selected result keeps its label, origin and UTC time. The empty and insufficient-data scenarios offer a link to Register. In the form integration: keep values on error, point to the invalid field in 422 responses and associate the message with the field.

## Reproduce

The script below records the verification of the original design-system demo. To run the Investigation screen connected to the API and reproduce its states, use the [AKM-16 script](akm-16-investigation-routine-ui.md). The wireframe keeps the simulation selectors.

```sh
npm --prefix frontend ci
python scripts/check.py
npm --prefix frontend run test:navigation
npm --prefix frontend run test:wireframe
npm --prefix frontend run build
npm --prefix frontend run dev
```

1. Open [the local shell](http://127.0.0.1:5173/#/dashboard). Check the explicit origin of the crew and the habitat, and the NASA scientific reference in another section. In Register, check the unit, zone, UTC time and origin. In History, find the suspect reading with its icon and label.
2. Open Investigation and select the three results. **Pattern to verify** reproduces the crew scenario with three affected profiles, an unconfirmed environmental hypothesis and a proposal for a new CO₂ reading. **No crew pattern** uses the comparable readings of the individual scenario in the crew scope. Only Aurora meets the individual criterion. **Insufficient data** reproduces the coverage of a single profile from the insufficient fixture. Check the label, the icon and the simulated origin on each result's card. The examples use fictional times and red appears only in the legend. [Synthetic scenarios](../../backend/tests/fixtures/odyssey-26-scenarios.json)
3. In the selector, go through **No observations**, **Loading** and **Connection failure**. The empty state shows the way to add a measurement. After selecting any result, check that it and its time stay visible during the failure, during loading and after the refresh button completes.
4. Test from 320 px. Use Tab and Enter on the skip-to-content link and the navigation links. Check the content focus after changing route. In History, Tab to the table region and use the arrow keys to scroll horizontally. Test back and forward and open the wireframe from the shell link.

The build was verified in Edge at 320, 768 and 1280 px. axe reported no WCAG A/AA violations on the four routes and the demonstrated states. The keyboard test checked navigation, focus, table scrolling and refresh actions. The measured contrast ratios between text and background of the states were 8.70:1 (information), 8.74:1 (neutral), 7.34:1 (positive), 7.53:1 (attention) and 7.59:1 (protocol). The measured navigation actions stayed above 6.6:1. [Minimum contrast](https://www.w3.org/TR/WCAG22/#contrast-minimum) · [Reflow](https://www.w3.org/TR/WCAG22/#reflow)

The [AKM-10 wireframe](akm-10-12-wireframes-and-shell.md) is the in-memory demo of registration, investigation and recheck. Integrating the API with the React shell belongs to AKM-13 to AKM-16.
