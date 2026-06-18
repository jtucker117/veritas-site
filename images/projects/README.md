# Project Photos

Drop project photos in this folder, then add a `<article class="project">` block in `builders.html` (or `kitchen-remodel.html` / `bathroom-remodel.html`) to display them on the site.

## Photo specs

| Setting | Recommended |
|---|---|
| Dimensions | 1600 × 1200 px (or 1600 × 1067 for 3:2 ratio) |
| Format | JPG (or WebP if you have a tool that exports it) |
| File size | Under 500 KB — compress before committing |
| Aspect ratio | The gallery card uses **4:3** — taller or wider photos will be cropped to fill |
| Filename | Descriptive, kebab-case, no spaces: `kitchen-magnolia-01.jpg`, `bathroom-woodlands-master-02.jpg` |

## How to add a project

1. Save the photo to this folder (e.g. `images/projects/kitchen-magnolia-01.jpg`)
2. Open `builders.html`, find the `RECENT PROJECTS` section
3. Copy this block and paste it inside `<div class="project-gallery">`:

```html
<article class="project">
  <img class="project-photo"
       src="images/projects/kitchen-magnolia-01.jpg"
       alt="Open-concept kitchen remodel in Magnolia, TX"
       loading="lazy" />
  <div class="project-meta">
    <span class="project-tag">Kitchen Remodel</span>
    <h4>Open Layout, Magnolia</h4>
    <p>Demoed a load-bearing wall, custom cabinets, quartz tops, and herringbone backsplash.</p>
  </div>
</article>
```

4. Update the `src`, `alt`, `project-tag`, `<h4>`, and `<p>` to match your project
5. Delete one of the `<article class="project placeholder">` blocks so the layout stays balanced
6. Commit + push — Railway auto-deploys

## Tips for great project photos

- **Daylight** beats artificial light — shoot mid-morning or late afternoon
- Use wide-angle phone shots for "wow" photos
- Capture before/during/after of the same angle when possible
- Keep tools, drop cloths, and people OUT of finished shots
- 1 hero "money shot" beats 5 mediocre angles
