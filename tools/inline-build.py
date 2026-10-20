# Inline the Vite build (dist/) into one self-contained HTML page for publishing as a Claude artifact.
# Usage: npx vite build && python3 tools/inline-build.py <out.html>
import glob, sys
js = open(glob.glob('dist/assets/*.js')[0]).read()
css = open(glob.glob('dist/assets/*.css')[0]).read()
assert '</script' not in js
page = f"""<title>Hallway Heroes</title>
<style>
html, body {{ margin: 0; height: 100%; overflow: hidden; background: #a8dcff; color-scheme: light; }}
:root {{ padding: 0 !important; }}
#game {{ display: block; width: 100vw; height: 100vh; outline: none; }}
#hud {{ position: fixed; inset: 0; pointer-events: none; user-select: none; }}
#hud.mode-explore .hh-bl, #hud.mode-explore .hh-tl {{ opacity: 0 !important; }}
#fps {{ position: fixed; left: 50%; top: 4px; transform: translateX(-50%); font: 11px monospace; color: #2a1a2e; opacity: 0.55; pointer-events: none; }}
{css}
</style>
<canvas id="game" tabindex="0"></canvas>
<div id="hud"></div>
<div id="fps"></div>
<script type="module">
{js}
</script>
"""
open(sys.argv[1], 'w').write(page)
print(len(page))
