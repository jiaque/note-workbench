# Small details in motion

These examples opt into motion explicitly. Ordinary notes keep their normal appearance. Return to [[Welcome]] or [[Roadmap]].

## A breathing card

<div data-nw-effect="breathe" data-nw-hover="lift" style="--nw-duration:2s;--nw-color:#2563eb;padding:16px;border-radius:8px;background-color:#eff6ff;color:#1e3a8a;">
  A little emphasis for a useful idea.
</div>

## A progress indicator

<div data-nw-effect="progress-striped" style="--nw-progress:60%;--nw-color:#2563eb;">
  Example plan: 60% complete
</div>

## An animated SVG

<svg xmlns="http://www.w3.org/2000/svg" width="480" height="90" viewBox="0 0 480 90">
  <title>A dot travelling between two stages</title>
  <rect x="20" y="34" width="440" height="12" rx="6" fill="#dbeafe"/>
  <circle cx="40" cy="40" r="12" fill="#2563eb">
    <animate attributeName="cx" values="40;440;40" dur="4s" repeatCount="indefinite"/>
  </circle>
  <text x="20" y="78" font-size="14" fill="#64748b">Question</text>
  <text x="386" y="78" font-size="14" fill="#64748b">Next step</text>
</svg>

The SVG is displayed as an isolated image. It plays automatically and has no interactive controls inside the image. Edit its source in the note; use the note menu to pause motion or replay SVG.
