# A button inside a label steals the click
- **Date / who:** 2026-11-12, claude
- **Problem:** BayReady settings switches that had a small (i) help button could not be turned on or off.
- **Cause:** the (i) was a `<button>` inside the `<label>`. A click on the label goes to its first control, which was the button, not the checkbox. The first fix guessed "panel fade" and was wrong.
- **Fix:** make the help mark `<span role="button" tabindex="0">` with a key handler (BayReady 2.76, `ui.js`).
- **Check:** click the label text in a browser test and read `checkbox.checked` before and after.
