# Design preview

`index.html` is the clickable design mockup the app's interface was built from: one self-contained HTML file with no build step. Open it in a browser.

It runs on sample data copied from discourse.atmosphere.community (most threads shortened, the five longest in full) and a few made-up accounts. The "Viewing as" switch in the bottom right shows the forum as a visitor, a newcomer, a member or a moderator. Nothing it does leaves the page.

The app in `src/` is the real implementation. Where the two differ, see the notes in the pull request that ported the design (#7).
