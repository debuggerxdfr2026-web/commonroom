# Commonroom interface

Commonroom is an Operate-first social workspace: people can keep up with one another, share small moments, and continue conversations without an infinite-scroll visual language.

## Visual system

- **Scene:** a welcoming evening room that still reads clearly in daylight. Dark charcoal is the starting theme; the user can switch to a matching light palette.
- **Palette:** charcoal page (`#11130f`), raised charcoal surfaces (`#171a16`), warm readable ink (`#f1f2ec`), clear periwinkle-blue actions (`#8ea8ff`), and restrained citron details (`#d7ed79`). Light theme uses a soft neutral page and deep blue actions.
- **Type:** system UI sans-serif for readable, fast-loading conversation text; a slightly heavier system face for headings. No remote font request is needed.
- **Shape and depth:** open editorial spacing, quiet one-pixel borders, small radii on functional surfaces, and no ornamental glow. Avatars and messages carry the human character.
- **Composition:** desktop has a persistent global header, a slim left wayfinding rail, the feed in the center, and a people/conversation rail. Mobile puts the feed first and uses a fixed five-item bottom navigation with safe-area padding.
- **Controls:** blue is reserved for primary actions and links. Citron indicates presence, selected navigation, and small moments of emphasis. All controls retain text labels or accessible names.

## Interaction and content

The theme choice is saved in `localStorage`; authentication never is. Sample content shown before sign-in is labeled as a preview. Seeded database users, posts, likes, comments, follows, notifications, and the demo conversation are synthetic local-development content.

Messages are persisted over the REST API and the open thread refreshes periodically. Uploads use a local disk adapter for development and are not durable across many serverless deployments. These MVP constraints are described in the README rather than presented as production capabilities.
