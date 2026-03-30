# Custom Author Style Guide Example

Override the default style guide by passing `--style-guide /path/to/this/file.md` to `/pai-msc`.

## Your Writing Preferences

Add your specific writing rules here. The writeup agent reads this file before writing any prose.

### Tone
- Write in first person plural ("we show", "we prove")
- Prefer active voice over passive
- Keep sentences under 25 words where possible

### Structure
- Target 8 pages (NeurIPS format)
- Abstract: 150 words max
- No more than 2 theorems in the main body; rest in appendix

### Field-Specific
- Use "neural network" not "deep learning model" unless referring to depth specifically
- Cite foundational works by author name, recent works by year
- Include at least one negative result or limitation per major claim

### Anti-Patterns to Avoid
- No "In recent years..." openings
- No "Furthermore, moreover, additionally" chains
- No citation-led paragraphs ("Smith et al. (2024) showed...")
- No "Our contributions are threefold"

## How to Use

```bash
/pai-msc --style-guide /path/to/my-style-guide.md "my hypothesis"
```

The style guide is copied into the workspace as `author_style_guide.md` and read by the writeup agent before any writing begins.
