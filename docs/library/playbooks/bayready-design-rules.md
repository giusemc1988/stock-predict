# Playbook: BayReady design rules (read before ANY BayReady UI change)

Chanh's standing rules for the BayReady panel. Every builder follows them: Claude, Milo, Hermes. He reviews on his phone and on the shop PCs from real screenshots, so he catches every break of these rules. Do not make him say them twice.

## 1. Never show the same information twice (most important)
- Before adding anything, search the panel for where it is already shown. If it is shown, do NOT add it again; link to it or leave it out.
- The car banner (name, engine/drive/body, VIN, RO, recalls, factory warranty) is shown once for Vehicle, TIS and MPI. Nothing below it may repeat those facts (no second warranty card under Specs, no car title inside a TIS card).
- A visit's done / declined / recommended / MPI lines are shown once, inside that visit. No second list of the same lines under it.
- A summary chip and a list that say the same thing: keep one. If a detail view replaces a chip, drop the chip.
- When you move something into the banner or a new place, delete the old copy in the SAME change and say so in What's new.
- Audit step in every UI change: open every tab (Chat, Cars, Vehicle > Specs/History/Recs/MPI, TIS, Shot, Jobs, Map) and read each screen for repeats before you say done.
- Do not remove a whole feature to fix a repeat. Remove the duplicate copy; keep the action reachable (for example "check again" is a small refresh icon in the banner).

## 2. Layout and look
- Sub-row (Specs / History / Recs / MPI) is centred under its tab and pinned at the top while scrolling; status/services bar pinned too. Pinned rows have a solid background.
- Anything clickable has a slight glow, but NOT the whole menu bar: only the chosen tab or the one under the finger/mouse. Glowing buttons never touch each other.
- No double borders or double rings (for example an RO chip inside another ring).
- The selection marker is the old glass water drop. It must sit centred in its bar, never touching the top edge.
- Boxes that hold text (can wrap to 2+ lines) have SMALL corners (about 10 to 12px) and padding 9px or more, so a curve never covers a word. Pills with big round corners only for one-line chips and buttons.
- No big empty boxes and no oversized controls (date pickers, count boxes). Small useful info in a small box. Important numbers (Total, Not arrived) are bigger than the rest, but not huge.
- Drop information that does not help a decision (for example the complaints chip). The tech must see the important facts at once: warranty, recalls, last visits.
- All text stays inside its box at 360, 390 and 820px wide. Nothing runs past the panel; long names get an ellipsis or wrap.

## 3. Behaviour
- Long lists fold: the factory warranty lines in the banner have a header to fold and open (remembered).
- A progress bar must always end. A refresh that was cut off (extension update, sleep) must not leave a spinner at 95% forever.
- Open tabs keep the old code after an update: tell Chanh to Reload the extension and F5 the open tabs.

## 4. How to check before you say done
1. Run the panel in the harness (Playwright with a mocked chrome API) at 360, 390 and 820px and LOOK at the screenshots.
2. Run the duplicate audit from rule 1.
3. Compare the release zip checksum with the tested build at both ends (wait about 15 seconds on the network mount first).
4. Release only when Chanh says so ("phát hành X"); say plainly what you could not verify on a real page.

See also `bayready-release.md` and `bayready-pipeline.md`.
