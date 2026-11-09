# Artwork display — 9 November 2026

The classic artwork viewer now fits the artwork to all available space below the site header. It reserves space only for an open details/music panel. The previous 64 px top, 72/112 px bottom, and 8 px inner margins are removed, and the image may scale up to fill its viewport. Aspect ratio is preserved; remaining letterboxing depends on screen and artwork proportions.

The expand button enters Exhibition view. It hides the entire site header, including navigation and donation banner, and fills the browser page. Tools and cursor hide after three seconds of inactivity; pointer movement, a tap, or keyboard focus reveals tools. Escape exits. Music remains mounted so playback can continue with the panel hidden.

Direct display URL: https://www.async.art/v2/800?fullscreen=true

Replace 800 with the artwork token ID (and v2 with v1 for v1 pieces). Existing query parameters can be followed by &fullscreen=true. This removes site chrome; use browser fullscreen (for example F11 on Windows) to remove the browser's own address bar. Direct URLs cannot automatically request native browser fullscreen without user interaction.
