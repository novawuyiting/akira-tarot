# AKIRA TAROT Article Publishing

Use GitHub Issues as a lightweight article CMS.

## Publish a new article

1. Open a new issue with the `AKIRA TAROT article` template.
2. Fill in the fields:
   - `Title`
   - `Slug`
   - `Description`
   - `Category`
   - `Hero title`
   - `Hero intro`
   - `中文正文`
   - optional `English Summary`
3. Keep the `draft` label while editing.
4. When the article is ready, remove `draft` and add `publish-article`.

The GitHub Action will:

- create or update `slug.html`
- move the article to the top of `content/articles.json`
- update the homepage latest-articles section
- add the page to `sitemap.xml`
- commit the changes automatically

## Edit a published article

Edit the same issue and make sure it still has the `publish-article` label. The action will regenerate the page.

## Slug rules

Use short English slugs, for example:

- `love-tarot-spread`
- `how-to-choose-tarot-deck`
- `breakup-tarot-questions`

The final URL will be:

`https://akiratarot.com/your-slug.html`
