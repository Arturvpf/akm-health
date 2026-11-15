"""Supplementary AKM-30 checks (not committed): all 8 routes, axe, overflow, keyboard pass, alert text+icon, external-request block."""
import json, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; AXE = sys.argv[2]
BASE = 'http://127.0.0.1:4500/#/'
ROUTES = ['dashboard', 'registrar', 'historico', 'investigacao', 'comparador', 'ambientes', 'corpo', 'autocuidado']
report = {'routes': {}, 'external': [], 'errors': [], 'console_errors': [], 'requests': []}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True,
        args=['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'])
    report['browser'] = b.version
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, locale='en-US')  # service worker allowed
    def guard(route):
        host = route.request.url.split('/')[2].split(':')[0] if '://' in route.request.url else ''
        if route.request.url.startswith(('data:', 'blob:')) or host == '127.0.0.1':
            return route.continue_()
        report['external'].append(route.request.url); return route.abort()
    ctx.route('**/*', guard)
    ctx.on('request', lambda r: report['requests'].append(r.url))
    page = ctx.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('console', lambda m: m.type == 'error' and report['console_errors'].append(m.text))
    for route in ROUTES:
        r = {}
        page.goto(BASE + route); page.wait_for_load_state('networkidle'); page.wait_for_timeout(800)
        r['h1'] = page.locator('h1').first.inner_text()
        for width in (1280, 320):
            page.set_viewport_size({'width': width, 'height': 900}); page.wait_for_timeout(300)
            overflow = page.evaluate('document.documentElement.scrollWidth - innerWidth')
            page.add_script_tag(path=AXE)
            axe = page.evaluate("""async () => { const x = await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
              return {violations: x.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0,3).map(n => n.target)})),
                      incomplete: x.incomplete.map(v => v.id), passes: x.passes.length}; }""")
            page.screenshot(path=f'{OUT}/{route}-{width}.png', full_page=True)
            r[str(width)] = {'overflow_px': overflow, **axe}
        page.set_viewport_size({'width': 1280, 'height': 900})
        # alerts/notices/badges: visible text label AND aria-hidden icon
        r['notices'] = page.evaluate("""() => [...document.querySelectorAll('.ds-notice, .ds-badge')].map(e => ({
            cls: e.className, icon: !!e.querySelector('.ds-icon[aria-hidden=true]'), text: (e.innerText || '').replace(/\\s+/g,' ').trim().slice(0,60)}))""")
        r['notice_missing'] = [n for n in r['notices'] if not n['icon'] or len(n['text'].replace('×','').strip()) < 2]
        r['notice_count'] = len(r['notices']); del r['notices']
        # keyboard-only pass
        page.goto(BASE + route); page.wait_for_load_state('networkidle'); page.wait_for_timeout(500)
        seq, problems = [], []
        page.locator('body').focus() if False else page.evaluate('document.activeElement && document.activeElement.blur()')
        for i in range(120):
            page.keyboard.press('Tab')
            info = page.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body) return null;
              const s = getComputedStyle(e); const rect = e.getBoundingClientRect();
              const name = (e.getAttribute('aria-label') || e.innerText || e.value || e.title || (e.labels && e.labels[0] && e.labels[0].innerText) || '').trim();
              return {tag: e.tagName, id: e.id, name: name.slice(0,40), visible: rect.width > 0 && rect.height > 0,
                      indicator: (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'}; }""")
            if info is None: continue
            key = (info['tag'], info['id'], info['name'])
            if seq and key == seq[0]: break
            seq.append(key)
            if not info['visible'] or not info['name'] or not info['indicator']: problems.append(info)
        r['keyboard'] = {'tab_stops': len(seq), 'first': seq[:3], 'problems': problems[:10]}
        if route == 'dashboard':
            page.goto(BASE + route); page.wait_for_load_state('networkidle')
            page.keyboard.press('Tab'); first = page.evaluate('document.activeElement.innerText')
            page.keyboard.press('Enter'); r['skip_link'] = {'first_tab': first, 'focus_after_enter': page.evaluate('document.activeElement.id')}
        report['routes'][route] = r
    # NASA data comes from the local API
    nasa = page.evaluate("fetch('/api/nasa/references').then(r => r.json())")
    report['nasa'] = {'historical_values': len(nasa.get('historical_series', [])), 'keys': list(nasa)[:8]}
    report['non_local_requests'] = [u for u in report['requests'] if not u.startswith(('http://127.0.0.1', 'data:', 'blob:'))]
    report['requests'] = len(report['requests'])
    b.close()
json.dump(report, open(f'{OUT}/supp-report.json', 'w'), indent=1, default=str)
print(json.dumps({k: v for k, v in report.items() if k != 'routes'}, default=str)[:1500])
for k, v in report['routes'].items():
    print(k, v['h1'], {w: (v[w]['overflow_px'], [x['id'] for x in v[w]['violations']], v[w]['incomplete']) for w in ('1280', '320')},
          'notices', v['notice_count'], 'bad', v['notice_missing'], 'kbd', v['keyboard']['tab_stops'], len(v['keyboard']['problems']), v.get('skip_link'))
