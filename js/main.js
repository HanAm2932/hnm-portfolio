(() => {
    const root = document.documentElement;

    /* ---------- header height, used by the full-screen sections ---------- */
    function measure() {
        const nav = document.querySelector('.nav');
        if (nav && nav.offsetHeight) root.style.setProperty('--navh', nav.offsetHeight + 'px');
    }
    measure();
    addEventListener('resize', measure);

    /* ---------- pictures: every picture is fetched as the page opens. One that has not arrived yet is marked .wait,
       so its box shows the skeleton (style.css); when it lands it fades in ---------- */
    document.querySelectorAll('.img > img, figure > img').forEach(img => {
        if (img.complete) { img.classList.add('in'); return; }
        const done = () => { img.classList.remove('wait'); img.classList.add('in'); };
        img.classList.add('wait');
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
    });

    /* ---------- loading screen: a visitor first meets a plain screen with a counter (.loader, the first thing in each page)
       while the whole site is fetched: this page's pictures and the ones behind them (hover backgrounds, the certificate sets,
       the full-size version of every small picture), and the same for every other page, found by following the links.
       Then the screen fades away and nothing is left to wait for, here or on the next page.
       The archive's 125 full-size pieces are left out: they still arrive as each one comes on screen.
       After ten seconds the screen lifts anyway and the rest keeps arriving behind the skeletons.
       Once everything is in, the visit is marked (sessionStorage.warm) and the <head> of the next page skips the screen. ---------- */
    const loader = document.querySelector('.loader');
    const here = location.href.split(/[?#]/)[0];
    const behind = new Set();
    const kept = [];                    /* the fetched pictures are held on to, so the browser keeps them in memory */
    let got = 0, total = 0, shown = 0, crawling = true, lifted = false;

    const lift = () => {
        if (lifted) return;
        lifted = true;
        /* everything was already in the browser's cache: no fade, the page is simply there */
        if (loader && performance.now() < 400) loader.remove();
        root.classList.remove('loading');
        if (loader) setTimeout(() => loader.remove(), 600);
    };
    const settle = () => {
        if (loader && total) {
            shown = Math.max(shown, got / total);       /* the counter never runs backwards when another page adds to the list */
            loader.style.setProperty('--p', shown);
            loader.querySelector('.loader-n').textContent = Math.round(shown * 100) + '%';
        }
        if (crawling || got < total) return;
        try { sessionStorage.setItem('warm', '1'); } catch (e) { }
        lift();
    };
    const tally = () => { got++; settle(); };
    const want = src => {
        if (behind.has(src)) return;
        behind.add(src);
        total++;
        const img = new Image();
        img.fetchPriority = 'low';      /* the pictures in this page go first */
        img.onload = img.onerror = tally;
        img.src = src;
        kept.push(img);
    };
    /* what a page holds behind its pictures; for another page, its pictures as well */
    const scan = (doc, base, other) => {
        const add = src => { if (src) want(new URL(src, base).href); };
        const within = from => {
            from.querySelectorAll('[data-bg]').forEach(el => { if (!el.closest('[data-run]')) add(el.dataset.bg); });
            from.querySelectorAll('img[data-full]').forEach(img => { if (!img.closest('[data-run]')) add(img.dataset.full); });
            from.querySelectorAll('template').forEach(t => {
                t.content.querySelectorAll('img[src]').forEach(img => add(img.getAttribute('src')));
                within(t.content);
            });
        };
        within(doc);
        if (other) doc.querySelectorAll('img[src]').forEach(img => add(img.getAttribute('src')));
    };
    const seen = new Set([here]);
    const crawl = (doc, base) => Promise.all(
        [...doc.querySelectorAll('a[href]')]
            .map(a => new URL(a.getAttribute('href'), base))
            .filter(u => u.origin === location.origin && u.pathname.endsWith('.html'))
            .map(u => u.origin + u.pathname)
            .filter(url => !seen.has(url) && seen.add(url))
            .map(async url => {
                try {
                    const res = await fetch(url);
                    if (!res.ok) return;
                    const page = new DOMParser().parseFromString(await res.text(), 'text/html');
                    scan(page, url, true);
                    await crawl(page, url);
                } catch (e) { }
            }));

    [...document.images].filter(img => img.getAttribute('src') && !img.complete).forEach(img => {
        total++;
        img.addEventListener('load', tally, { once: true });
        img.addEventListener('error', tally, { once: true });
    });
    if (navigator.connection && navigator.connection.saveData) { crawling = false; settle(); }
    else {
        scan(document, here, false);
        crawl(document, here).then(() => { crawling = false; settle(); });
    }
    setTimeout(lift, 10000);

    /* ---------- language: English is in the page, Vietnamese sits in data-vi ---------- */
    const texts = [...document.querySelectorAll('[data-vi]')];
    texts.forEach(el => el.dataset.en = el.innerHTML);

    function setLang(lang) {
        texts.forEach(el => el.innerHTML = lang === 'vi' ? el.dataset.vi : el.dataset.en);
        root.lang = lang;
        document.querySelectorAll('.langbtn [data-l]').forEach(u => u.classList.toggle('on', u.dataset.l === lang));
        try { localStorage.setItem('lang', lang); } catch (e) { }
        root.dispatchEvent(new Event('langchange'));
    }

    let saved = 'en';
    try { saved = localStorage.getItem('lang') || 'en'; } catch (e) { }
    setLang(saved);

    const langBtn = document.querySelector('.langbtn');
    if (langBtn) langBtn.addEventListener('click', () => setLang(root.lang === 'vi' ? 'en' : 'vi'));

    /* ---------- light and dark follow the computer: the <head> of each page sets data-theme before the first paint, this keeps it in step ---------- */
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        root.dataset.theme = e.matches ? 'dark' : 'light';
        root.dispatchEvent(new Event('themechange'));
    });

    /* hovering a project changes the background of its own column (Selected works or Side projects) to that project's image.
       A row can carry data-bg="img/file.jpg"; until then the layer is the crossed placeholder with the row's label. */
    document.querySelectorAll('.trow[data-img]').forEach(row => {
        const sec = row.closest('.cols2 > div') || row.closest('.sec');
        if (!sec) return;
        let bg = sec.querySelector(':scope > .sec-bg');
        if (!bg) {
            bg = document.createElement('div');
            bg.className = 'sec-bg';
            bg.setAttribute('aria-hidden', 'true');
            bg.appendChild(document.createElement('span'));
            sec.prepend(bg);
        }
        /* the row's photo already lies in the layer, fetched and drawn, so a hover only has to uncover it */
        let pic = null;
        if (row.dataset.bg) {
            pic = document.createElement('img');
            pic.alt = '';
            pic.src = row.dataset.bg;
            bg.prepend(pic);
        }
        row.addEventListener('mouseenter', () => {
            bg.querySelector('span').textContent = pic ? '' : row.dataset.img;
            bg.querySelectorAll('img').forEach(img => img.classList.toggle('on', img === pic));
            bg.classList.toggle('photo', !!pic);
            bg.classList.add('show');
        });
        row.addEventListener('mouseleave', () => bg.classList.remove('show'));
    });

    /* hovering a project row floods it deep red from left to right. The front of the sweep is made of lines of H, n and M letters
       (HHnMM, nMMHn...) laid out in horizontal rows, that settle into solid red as the sweep passes; leaving sweeps it away the same way */
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const CW = 11, CH = 14, SPAN = 730, JITTER = .12, LETTERS = 'HnM', LIFE = .4;
        document.querySelectorAll('.trow[data-img]').forEach(row => {
            const cv = document.createElement('canvas');
            cv.className = 'pix';
            cv.setAttribute('aria-hidden', 'true');
            row.prepend(cv);
            const ctx = cv.getContext('2d');
            let cols = 0, rows = 0, cells = [], t0 = 0, raf = 0;

            const size = () => {
                cols = Math.ceil(row.clientWidth / CW); rows = Math.ceil(row.clientHeight / CH);
                cv.width = cols * CW; cv.height = rows * CH;
                cells = [];
                for (let y = 0; y < rows; y++) {
                    /* each line is its own irregular run: a letter repeats a few times, then another takes over */
                    let ch = LETTERS[Math.floor(Math.random() * LETTERS.length)];
                    for (let x = 0; x < cols; x++) {
                        if (Math.random() < .55) ch = LETTERS[Math.floor(Math.random() * LETTERS.length)];
                        cells.push({ t: Math.random(), ch });
                    }
                }
            };

            /* filling and erasing are two separate sweeps, both left to right: kin is how far the fill has got, q how far the erase has */
            let kin = 0, q = 0, mode = 'in', kin0 = 0;
            const T = 1 + JITTER + LIFE;

            const draw = now => {
                const p = Math.min(1, (now - t0) / SPAN);
                if (mode === 'in') kin = kin0 + (1 - kin0) * p; else q = p;
                const red = getComputedStyle(document.documentElement).getPropertyValue('--title').trim() || '#761f21';
                ctx.clearRect(0, 0, cv.width, cv.height);
                ctx.fillStyle = red;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '400 ' + Math.round(CH * .9) + 'px ' + getComputedStyle(row).fontFamily;
                for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                    const c = cells[y * cols + x];
                    const th = x / cols + c.t * JITTER;
                    const inL = kin * T - th;
                    if (inL <= 0) continue;
                    const outL = q * T - th;
                    if (outL >= LIFE) continue;
                    if (outL > 0 || inL < LIFE) ctx.fillText(c.ch, x * CW + CW / 2, y * CH + CH / 2);
                    else ctx.fillRect(x * CW, y * CH, CW, CH);
                }
                raf = p < 1 ? requestAnimationFrame(draw) : 0;
            };

            const go = target => {
                cancelAnimationFrame(raf);
                if (!cols || cv.width !== Math.ceil(row.clientWidth / CW) * CW) size();
                if (target) {
                    /* coming back in mid-erase starts the fill afresh; mid-fill just carries on */
                    if (mode === 'out' && q > 0) kin = 0;
                    mode = 'in'; q = 0; kin0 = kin;
                } else {
                    mode = 'out'; q = 0;
                }
                t0 = performance.now();
                raf = requestAnimationFrame(draw);
            };
            row.addEventListener('mouseenter', () => go(1));
            row.addEventListener('mouseleave', () => go(0));
        });
    }

    /* ---------- samples: scrolling through the pinned section stacks the samples: each new one rises from below and covers the last; arrows and dots do the same ---------- */
    const hs = document.getElementById('samples');
    if (hs) {
        const hpin = hs.querySelector('.hpin');
        const cslides = [...hs.querySelectorAll('.cslide')];
        const dots = [...hs.querySelectorAll('.pager i')];
        let at = 0;

        const slide = () => {
            if (!hs.offsetHeight) return;
            const top = parseFloat(getComputedStyle(hpin).top) || 0;
            const span = hs.offsetHeight - hpin.offsetHeight;
            const p = Math.min(1, Math.max(0, (top - hs.getBoundingClientRect().top) / span));
            const pos = p * (cslides.length - 1);
            const lift = hpin.offsetHeight;
            cslides.forEach((s, i) => {
                const d = i - pos;
                /* waiting cards sit below the screen and rise over the current one; covered cards step back a little */
                const back = Math.min(2, Math.max(0, -d));
                const y = d > 0 ? d * lift : -back * 18;
                s.style.transform = 'translate(-50%,-50%) translateY(' + y + 'px) scale(' + (1 - back * .05) + ')';
                s.querySelector('p').style.opacity = 1 - Math.min(1, Math.abs(d) * 2);
            });
            at = Math.round(pos);
            dots.forEach((d, i) => d.classList.toggle('on', i === at));
        };

        const toSample = k => {
            k = Math.max(0, Math.min(cslides.length - 1, k));
            const start = hs.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(hpin).top) || 0);
            scrollTo({ top: start + k * hpin.offsetHeight, behavior: 'smooth' });
        };

        hs.querySelectorAll('.pager a').forEach(a => a.addEventListener('click', () => toSample(at + Number(a.dataset.step))));
        dots.forEach((d, i) => d.addEventListener('click', () => toSample(i)));
        addEventListener('scroll', slide, { passive: true });
        addEventListener('resize', slide);
        slide();
    }

    /* ---------- how I work: the hovered (or focused, or tapped) step becomes the active one ---------- */
    const tlSteps = [...document.querySelectorAll('.tl-step')];
    tlSteps.forEach(step => {
        const pick = () => tlSteps.forEach(s => s.classList.toggle('on', s === step));
        step.addEventListener('mouseenter', pick);
        step.addEventListener('focus', pick);
        step.addEventListener('click', pick);
    });

    /* ---------- floating page switcher: closed it shows the current page, a click opens the list ---------- */
    const pill = document.getElementById('pill');
    if (pill) {
        pill.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (!pill.classList.contains('open') || (link && link.classList.contains('cur'))) e.preventDefault();
            pill.classList.toggle('open');
        });
    }

    /* ---------- archive: filter chips ---------- */
    const chips = [...document.querySelectorAll('.chips [data-kind]')];
    const pick = chip => {
        chips.forEach(c => c.setAttribute('aria-pressed', c === chip));
        document.querySelectorAll('figure[data-kind]').forEach(f => {
            f.hidden = chip.dataset.kind !== 'all' && !f.dataset.kind.split(' ').includes(chip.dataset.kind);
        });
    };
    chips.forEach(chip => {
        chip.addEventListener('click', () => pick(chip));
        chip.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(chip)));
    });

    /* ---------- certificates: a click opens the paper large, over the blurred page.
       A grouped certificate opens its whole set first; picking one from the set shows that one large. ---------- */
    const box = document.getElementById('lightbox');
    if (box) {
        const pic = box.querySelector('img');
        const set = box.querySelector('.lightbox-set');
        let from = null, inSet = false;

        /* in the gallery the photos of the line open here, one at a time */
        document.querySelectorAll('.pline figure').forEach(f => {
            const img = f.querySelector('img');
            f.dataset.bg = img.dataset.full || img.getAttribute('src');
            f.dataset.img = '';
            f.addEventListener('click', () => { if (f.closest('.pline').classList.contains('grid')) open(f); });
        });

        const shut = () => {
            box.hidden = true; root.style.overflow = '';
            if (from) from.focus();
        };
        const one = (src, alt) => {
            pic.src = src; pic.alt = alt;
            pic.hidden = false; set.hidden = true;
        };
        const all = () => { pic.hidden = true; set.hidden = false; };
        const open = row => {
            from = row;
            inSet = !!row.dataset.set;
            if (inSet) {
                set.innerHTML = document.getElementById(row.dataset.set).innerHTML;
                set.classList.toggle('many', set.children.length > 8);
                /* the set arrives in English: put it into the page's current language */
                if (root.lang === 'vi') set.querySelectorAll('[data-vi]').forEach(el => el.innerHTML = el.dataset.vi);
                all();
            } else one(row.dataset.bg, row.dataset.img);
            box.hidden = false; root.style.overflow = 'hidden';
            box.querySelector('.lightbox-x').focus();
        };

        document.querySelectorAll('.trow.cert, .trow.group').forEach(row => {
            row.addEventListener('click', () => open(row));
            row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(row); } });
        });
        box.addEventListener('click', e => {
            const tile = e.target.closest('.set-tile');
            if (tile && tile.dataset.bg) { one(tile.dataset.bg, tile.dataset.img); return; }
            if (e.target.closest('.lightbox-set')) return;                       /* a click on the set itself does nothing */
            if (inSet && !pic.hidden && !e.target.closest('.lightbox-x')) { all(); return; }   /* back from one paper to the set */
            shut();
        });
        addEventListener('keydown', e => {
            if (e.key !== 'Escape' || box.hidden) return;
            if (inSet && !pic.hidden) all(); else shut();
        });
    }

    /* ---------- home: lines of photos. Each line holds its photos small, side by side across the section;
       the ones near the pointer grow, drift above and below the line and overlap.
       A line with data-count and no photos inside fills itself with placeholders. ---------- */
    const SHAPES = [1.5, .8, 1, 1.33, .67, 1.5, 1, .8, 1.78, 1, .75, 1.5, 1.25, .67, 1, 1.5, .8, 1.33, 1, 1.5, .75, 1.25, 1, 1.6];
    const plines = [...document.querySelectorAll('.pline')];
    plines.forEach((pline, row) => {
        if (!pline.children.length) {
            const vi = root.lang === 'vi';
            for (let i = 0; i < Number(pline.dataset.count || 0); i++) {
                const f = document.createElement('figure');
                f.className = 'img';
                f.dataset.ratio = SHAPES[(i + row * 7) % SHAPES.length];
                f.innerHTML = '<span>' + (vi ? 'Ảnh của bạn' : 'Own photo') + '</span>';
                pline.appendChild(f);
            }
        }
        const figs = [...pline.querySelectorAll('figure')];
        const N = figs.length;
        if (N < 2) return;
        const BASE = 180;
        const DRIFT = [-1, .45, -.3, .95, -.75, .2, .7, -.5, 1, -.15, .55, -.9];
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        figs.forEach(f => {
            f.bw = BASE * Number(f.dataset.ratio || 1);
            const img = f.querySelector('img');
            if (img) img.decoding = 'async';      /* a big picture is unpacked aside, not in the middle of a frame */
        });

        let W = 0, push = 0, step = 0, LOOP = 1;
        let focus = 0, goal = focus, open = 0, openGoal = 0, raf = 0;
        /* the photos crawl to the right like cars in a jam, a loop longer than the screen that wraps out of sight. Each one
           wants its own speed for a while and has its own acceleration, and none passes the one ahead: it pulls away, stalls,
           and the ones behind close up and follow. Traffic stops while the pointer is on the line */
        const GAP = 28, MARGIN = 200, PACE = 2;      /* room between two photos in the loop; how far past the left edge a photo wraps; how fast the whole road runs */
        const KEEP = 10, HEADWAY = 1.2, BRAKE = 30;      /* the gap a photo keeps standing, px; and moving, s; how hard it brakes, px/s^2 */
        const EASE = 170;      /* ms the photos take to answer the pointer or the wheel, about two thirds of the way */
        let last = 0, seen = true;
        /* the gallery: the same photos leave the road, each at its own moment, and settle in rows in the same space */
        const SETTLE = 1100, LATE = .5, PAD = 20, TIGHT = 6;      /* ms for one photo; how much of that the last one waits; side margin; between photos */
        let gridT = 0, gridGoal = 0, over = -1;
        figs.forEach(f => { f.late = Math.random(); f.lift = 0; });
        /* a line with data-run (the archive) holds far more than a screen and has no page to scroll: the wheel, a swipe
           or the arrow keys run its whole road past the screen, and the piece in view is named under the line */
        const runs = pline.hasAttribute('data-run');
        const num = document.getElementById('arch-n'), cap = document.getElementById('arch-cap');
        let shift = 0, shiftGoal = 0, swipe = null, named = -1;

        /* the rows that give the largest photos in this space: try each count, keep each photo's shape */
        const arrange = () => {
            const H = pline.clientHeight - 8, room = W - PAD * 2;
            const total = figs.reduce((sum, f) => sum + f.bw, 0) / BASE;
            let best = null;
            for (let count = 1; count <= 16; count++) {
                const rows = [[]];
                let sum = 0;
                figs.forEach(f => {
                    const r = f.bw / BASE;
                    if (sum + r / 2 > total / count * rows.length && rows.length < count) rows.push([]);
                    rows[rows.length - 1].push(f);
                    sum += r;
                });
                const heights = rows.map(row => (room - TIGHT * (row.length - 1)) / row.reduce((a, f) => a + f.bw / BASE, 0));
                if (heights.some(h => h <= 0)) continue;      /* so many in a row that the gaps alone overfill it */
                const tall = heights.reduce((a, b) => a + b, 0), gaps = TIGHT * (rows.length - 1);
                const fit = Math.min(1, (H - gaps) / tall);
                const mean = tall * fit / rows.length;
                if (!best || mean > best.mean) best = { rows, heights, fit, mean, used: tall * fit + gaps };
            }
            if (!best) return;      /* no width yet, the page is laid out in a hidden frame */
            let y = -best.used / 2;
            best.rows.forEach((row, r) => {
                const h = best.heights[r] * best.fit;
                let x = (W - row.reduce((a, f) => a + f.bw / BASE * h, 0) - TIGHT * (row.length - 1)) / 2;
                row.forEach(f => {
                    f.gw = f.bw / BASE * h; f.gh = h;
                    f.gx = x + f.gw / 2; f.gy = y + h / 2;
                    x += f.gw + TIGHT;
                });
                y += h + TIGHT;
            });
        };

        const size = () => {
            W = pline.clientWidth;
            push = Math.min(220, W * .18);
            const widths = figs.reduce((sum, f) => sum + f.bw, 0);
            const gap = Math.max(GAP, (W + MARGIN * 2 - widths) / N);
            const before = LOOP;
            let at = 0;
            figs.forEach(f => {
                if (f.pos === undefined) {
                    f.pos = at + f.bw / 2;
                    f.speed = 0; f.wish = 0; f.until = 0;
                    f.pull = 5 + Math.random() * 25;      /* its acceleration, px/s^2 */
                } else f.pos *= (widths + gap * N) / before;
                at += f.bw + gap;
            });
            shift *= at / before; shiftGoal *= at / before;
            LOOP = at;
            step = at / N;
            arrange();
        };

        /* a new mood for one photo: stand, crawl, or now and then break away */
        const decide = (f, now) => {
            const r = Math.random();
            const [lo, hi, time] = r < .3 ? [0, 0, 1 + Math.random() * 3] : r < .85 ? [8, 24, 3 + Math.random() * 5] : [30, 50, 2 + Math.random() * 2];
            f.wish = lo + Math.random() * (hi - lo);
            f.until = now + time;
        };

        /* car following: speed up towards the wish, ease off as the gap to the photo ahead closes */
        let road = 0;
        const move = dt => {
            road += dt;
            figs.forEach((f, i) => {
                if (road >= f.until) decide(f, road);
                const ahead = figs[(i + 1) % N];
                const room = Math.max(1, ((ahead.pos - f.pos) % LOOP + LOOP) % LOOP - (f.bw + ahead.bw) / 2);
                const want = KEEP + f.speed * HEADWAY + f.speed * (f.speed - ahead.speed) / (2 * Math.sqrt(f.pull * BRAKE));
                f.accel = f.pull * (1 - Math.pow(f.speed / Math.max(f.wish, .5), 4) - Math.pow(Math.max(want, 0) / room, 2));
            });
            figs.forEach(f => {
                f.speed = Math.max(0, f.speed + Math.max(f.accel, -BRAKE * 2) * dt);
                f.pos += f.speed * dt;
            });
        };

        const draw = () => {
            /* how many neighbours open with the focused photo depends on how tightly the line is packed */
            const spread = Math.min(7, Math.max(1.6, 70 / Math.max(step, 1)));
            const H = pline.clientHeight;
            const tall = Math.min(360, H * .85, W * .6), drift = Math.min(70, H * .16, W * .1);
            const big = Math.max(tall, H * .6), dpr = devicePixelRatio || 1;
            let best = 0, bestNear = -Infinity;
            figs.forEach((f, i) => {
                const u = ((f.pos + shift + MARGIN) % LOOP + LOOP) % LOOP - MARGIN;      /* where this photo sits along the line, px */
                const d = (u - focus) / step;
                const near = Math.exp(-(d * d) / (spread * spread)) * open;
                const x = u + Math.tanh(d / (spread * 1.1)) * push * open;
                const y = DRIFT[i % DRIFT.length] * drift * near;
                const scale = 1 + near * (Math.min(tall / BASE, W * .5 / f.bw) - 1);
                let w = f.bw * scale, h = BASE * scale, px = x, py = y;
                const raw = Math.max(0, Math.min(1, gridT * (1 + LATE) - f.late * LATE));
                const g = raw * raw * (3 - 2 * raw);
                if (g) {
                    const grow = 1 + f.lift * (Math.max(1.4, H * .6 / f.gh) - 1);
                    const gw = f.gw * grow, gh = f.gh * grow;
                    const gx = Math.max(gw / 2 + 4, Math.min(W - gw / 2 - 4, f.gx));
                    const gy = Math.max(gh / 2 - H / 2, Math.min(H / 2 - gh / 2, f.gy));
                    const off = Math.min(x, W + 300);      /* a photo far along the road starts just past the edge */
                    px = off + (gx - off) * g; py = y + (gy - y) * g;
                    w += (gw - w) * g; h += (gh - h) * g;
                }
                f.h = h;
                /* nothing is laid out while it moves: a photo keeps its box, which the browser's graphics card only slides and scales.
                   The box changes once, to the large size when a photo starts to open, so it stays sharp at any size,
                   and back when it has closed. A photo off the screen is neither drawn nor moved */
                const on = px + w / 2 > -40 && px - w / 2 < W + 40;
                if (on !== f.on) { f.on = on; f.style.visibility = on ? '' : 'hidden'; }
                if (!on) return;
                const low = g === 1 ? f.gh : BASE;
                const box = h > low * 1.05 ? big : low;
                if (box !== f.box) {
                    f.box = box;
                    const bw = box * f.bw / BASE;
                    f.style.width = bw + 'px';
                    f.style.height = box + 'px';
                    f.style.marginLeft = -bw / 2 + 'px';
                    f.style.marginTop = -box / 2 + 'px';
                }
                f.style.transform = 'translate(' + px + 'px,' + py + 'px) scale(' + h / box + ')';
                const z = Math.round(Math.max(near, f.lift) * 1000);
                if (z !== f.z) { f.z = z; f.style.zIndex = z; }
                f.classList.toggle('up', near > .35 || f.lift > .3);
                const img = f.querySelector('img[data-full]');
                /* the small picture is enough until the photo is shown larger than it */
                if (img && h * dpr > Number(img.getAttribute('height'))) {
                    const full = img.dataset.full, ready = new Image();
                    delete img.dataset.full;
                    ready.src = full;
                    (ready.decode ? ready.decode() : Promise.resolve()).catch(() => { }).then(() => { img.src = full; });
                }
                const score = Math.max(near, f.lift) - Math.abs(px - W / 2) / 1e6;
                if (score > bestNear) { bestNear = score; best = i; }
            });
            if (runs && best !== named) {
                named = best;
                num.textContent = String(best + 1).padStart(2, '0') + ' / ' + N;
                cap.textContent = figs[best].querySelector('figcaption').textContent;
            }
        };

        const tick = now => {
            raf = 0;
            const dt = Math.min(now - (last || now), 60);
            last = now;
            const k = still ? 1 : 1 - Math.exp(-dt / EASE);
            focus += (goal - focus) * k;
            open += (openGoal - open) * k;
            if (Math.abs(goal - focus) < .2) focus = goal;
            if (Math.abs(openGoal - open) < .002) open = openGoal;
            shift += (shiftGoal - shift) * k;
            if (Math.abs(shiftGoal - shift) < .2) shift = shiftGoal;
            if (!still) move(PACE * dt * (1 - open) * (1 - gridT) / 1000);
            gridT = still ? gridGoal : gridT < gridGoal ? Math.min(gridGoal, gridT + dt / SETTLE) : Math.max(gridGoal, gridT - dt / SETTLE);
            figs.forEach((f, i) => {
                f.lift += ((i === over ? 1 : 0) - f.lift) * k;
                if (Math.abs((i === over ? 1 : 0) - f.lift) < .002) f.lift = i === over ? 1 : 0;
            });
            draw();
            if (!open && openGoal === 0) pline.classList.remove('live');
            if (!still && seen || focus !== goal || open !== openGoal || shift !== shiftGoal || gridT !== gridGoal || figs.some((f, i) => f.lift !== (i === over ? 1 : 0))) raf = requestAnimationFrame(tick);
        };
        const go = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };

        const steer = e => {
            const box = pline.getBoundingClientRect();
            if (gridGoal) {
                const mx = e.clientX - box.left, my = e.clientY - box.top - box.height / 2;
                over = figs.findIndex(f => Math.abs(mx - f.gx) < f.gw / 2 && Math.abs(my - f.gy) < f.gh / 2);
                go();
                return;
            }
            if (runs && e.pointerType !== 'mouse') {
                if (swipe !== null) shiftGoal += (e.clientX - swipe) * 1.4;
                swipe = e.clientX;
            }
            goal = e.clientX - box.left;
            openGoal = 1; pline.classList.add('live'); go();
        };
        pline.addEventListener('pointermove', steer);
        pline.addEventListener('pointerdown', steer);
        pline.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { openGoal = 0; over = -1; go(); } });
        if (runs) {
            pline.closest('section').addEventListener('wheel', e => {
                e.preventDefault();
                if (gridGoal) return;
                shiftGoal -= (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * .6;
                go();
            }, { passive: false });
            addEventListener('pointerup', () => { swipe = null; });
            addEventListener('pointercancel', () => { swipe = null; });
            pline.addEventListener('keydown', e => {
                if (gridGoal || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
                e.preventDefault();
                shiftGoal += e.key === 'ArrowRight' ? -step : step;
                goal = W / 2; openGoal = 1; pline.classList.add('live'); go();
            });
            pline.addEventListener('blur', () => { openGoal = 0; go(); });
        }
        const views = [...pline.closest('section').querySelectorAll('[data-view]')];
        views.forEach(button => button.addEventListener('click', () => {
            const on = button.dataset.view === 'grid';
            views.forEach(b => b.setAttribute('aria-pressed', b === button));
            pline.classList.toggle('grid', on);
            gridGoal = on ? 1 : 0;
            openGoal = 0; over = -1;
            size(); go();
        }));
        addEventListener('resize', () => { size(); draw(); });

        /* only run while the line is on screen */
        new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) go(); }).observe(pline);

        size();
        draw();
        go();
    });

    /* ---------- home, behind the photos: rows of h, n and m in any case, packed as tight as the background letters,
       running left, against the photos. Seen from afar they draw a giant HnM: the letters inside its shape rise out of a faint
       field and sink back in one mass, swept along the word, and return in the next colour of the palette.
       All of it stops while the line of photos is hovered. ---------- */
    document.querySelectorAll('.pbg').forEach(bg => {
        const ROW = 13, CELL = 14, PULSE = 10000, MARGIN = 20;
        const FRAME = 50, FAINT = .1, SWEEP = .2, FEATHER = .05, DRIFT = .015;   /* the field outside the shape; how far apart the word's two ends and two letters pulse; the shape's px per ms */
        const LETTERS = [...'hnmHNM'], COLOURS = ['--title', '--accent', '--ink'];
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const canvas = document.createElement('canvas');
        bg.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        /* each letter in each colour, at twice its size so it stays sharp */
        const atlas = document.createElement('canvas');
        atlas.width = LETTERS.length * CELL * 2;
        atlas.height = COLOURS.length * ROW * 2;
        const font = '400 11px ' + getComputedStyle(document.body).fontFamily;
        let widths = [];
        const tint = () => {
            const t = atlas.getContext('2d'), css = getComputedStyle(root);
            t.setTransform(2, 0, 0, 2, 0, 0);
            t.clearRect(0, 0, atlas.width, atlas.height);
            t.font = font;
            t.textBaseline = 'middle';
            COLOURS.forEach((c, y) => {
                t.fillStyle = css.getPropertyValue(c).trim();
                LETTERS.forEach((l, x) => t.fillText(l, x * CELL, y * ROW + ROW / 2));
            });
            widths = LETTERS.map(l => t.measureText(l).width);
        };

        /* the giant word, as a map of how far each pixel lies inside it. Its letters lean, with their horizontals kept level, and sit out of line,
           each its own way, across a few words so the pattern takes long to come round again */
        const WORDS = 3;
        const swing = max => (Math.random() * 2 - 1) * max;
        const marks = [...('HnM'.repeat(WORDS))].map(letter => ({
            letter, lean: swing(.4), up: swing(.1), scale: .85 + Math.random() * .35, gap: .05 + Math.random() * .2
        }));
        let mask = null, P = 1;
        const shape = () => {
            const m = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
            const size = H * 1.3;      /* set by the height alone: on a narrow screen one letter of the word passes at a time */
            const face = '700 ' + size + 'px ' + getComputedStyle(document.body).fontFamily;
            m.font = face;
            let x = size * .2;
            const laid = marks.map(g => {
                const box = m.measureText(g.letter), w = box.width * g.scale;
                const at = { g, x: x + w / 2, mid: (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2 };
                x += w + g.gap * size;
                return at;
            });
            P = Math.ceil(x + size * .2);
            m.canvas.width = P; m.canvas.height = Math.max(1, H);
            m.font = face;
            m.textAlign = 'center';
            laid.forEach(({ g, x, mid }) => {
                m.save();
                m.translate(x, H / 2 + g.up * H);
                m.transform(1, 0, g.lean, 1, 0, 0);
                m.scale(g.scale, g.scale);
                m.fillText(g.letter, 0, mid);
                m.restore();
            });
            mask = m.getImageData(0, 0, P, m.canvas.height).data;
        };

        let W = 0, H = 0, rows = [], clock = 0, rate = 1, goal = 1, last = 0, raf = 0, seen = true, due = 0;

        const build = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            W = bg.clientWidth; H = bg.clientHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            shape();
            rows = [];
            for (let r = 0; r * ROW < H; r++) {
                const letters = [];
                let x = 0;
                while (x < W + MARGIN * 2) {
                    const l = Math.floor(Math.random() * LETTERS.length);
                    letters.push({ l, x, phase: Math.random(), turn: Math.floor(Math.random() * 3) });
                    x += widths[l];
                }
                rows.push({ letters, len: x, speed: .013 + Math.random() * .005, start: Math.random() * x });   /* px per ms, a little apart */
            }
        };

        const paint = () => {
            ctx.clearRect(0, 0, W, H);
            const drift = clock * DRIFT;
            rows.forEach((row, r) => {
                const off = row.start + clock * row.speed;
                const my = Math.min(Math.floor(H) - 1, r * ROW + (ROW >> 1));
                row.letters.forEach(g => {
                    const x = ((g.x - off + MARGIN) % row.len + row.len) % row.len - MARGIN;
                    if (x > W) return;
                    const mx = ((Math.floor(x + drift) % P) + P) % P;
                    const inside = mask[(my * P + mx) * 4 + 3] / 255;
                    const at = clock / PULSE + mx / P * SWEEP + g.phase * FEATHER, round = Math.floor(at);
                    const rise = still ? 1 : Math.min(1, Math.sin((at - round) * Math.PI) * 2.5);
                    ctx.globalAlpha = FAINT + (1 - FAINT) * inside * rise;
                    const c = (round + g.turn) % 3;
                    ctx.drawImage(atlas, g.l * CELL * 2, c * ROW * 2, CELL * 2, ROW * 2, x, r * ROW, CELL, ROW);
                });
            });
        };

        const tick = now => {
            raf = 0;
            clock += Math.min(now - (last || now), 60) * rate;
            last = now;
            rate += (goal - rate) * .18;
            if (Math.abs(goal - rate) < .002) rate = goal;
            /* thousands of letters: they move slowly enough for fewer frames, and never take more than a quarter of the time, so the photos above keep every frame */
            if (rate && now >= due) {
                const begun = performance.now();
                paint();
                due = now + Math.max(FRAME, (performance.now() - begun) * 4);
            }
            if (seen) raf = requestAnimationFrame(tick);
        };
        const go = () => { if (still) paint(); else if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };

        const line = bg.parentElement;
        line.addEventListener('pointerenter', () => { goal = 0; });
        line.addEventListener('pointerleave', () => { goal = 1; });
        root.addEventListener('themechange', () => { tint(); paint(); });
        new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) go(); }).observe(bg);
        new ResizeObserver(() => { build(); go(); }).observe(bg);
        document.fonts.ready.then(() => { tint(); build(); go(); });
        tint();
    });

    /* ---------- case study picture block: the whole picture follows the mouse ---------- */

    const tiles = document.querySelectorAll('.mosaic .img.has-photo');
    if (tiles.length && matchMedia('(hover: hover)').matches) {
        const peek = document.createElement('div');
        peek.className = 'peek';
        peek.setAttribute('aria-hidden', 'true');
        const big = document.createElement('img');
        big.alt = '';
        peek.appendChild(big);
        document.body.appendChild(peek);

        // beside the pointer, flipped or nudged so it never leaves the screen
        const place = e => {
            const w = peek.offsetWidth, h = peek.offsetHeight, gap = 20;
            let x = e.clientX + gap, y = e.clientY - h / 2;
            if (x + w > innerWidth - 8) x = e.clientX - gap - w;
            x = Math.max(8, x);
            y = Math.max(8, Math.min(innerHeight - h - 8, y));
            peek.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        };

        tiles.forEach(tile => {
            const img = tile.querySelector('img');
            tile.addEventListener('pointerenter', e => {
                if (e.pointerType !== 'mouse') return;
                big.src = img.dataset.full || img.currentSrc || img.src;
                place(e);
                peek.classList.add('on');
            });
            tile.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') place(e); });
            tile.addEventListener('pointerleave', () => peek.classList.remove('on'));
        });
        addEventListener('scroll', () => peek.classList.remove('on'), { passive: true });
    }

    /* ---------- background letters: rows of HnM lie under the whole page, unseen, behind its text and pictures.
       The mouse uncovers a small feathered patch of them and leaves a short trail. A click sends a wave out across them;
       the lines that divide the page are dams to it, so it hits them and comes back.
       Inside a patch each letter keeps fading out and back in, in its own time, and returns in the next colour of the palette.
       The rows belong to the page, so scrolling carries them past the mouse, and the mouse leaves the same trail
       on the page as if it had moved. Only for a real mouse. ---------- */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const D = 110;                      /* width of the patch, px */
        const ROW = 13;                     /* distance between two rows of letters, px */
        const GAP = 8;                      /* distance between two patches in the trail, px */
        const LIFE = 450;                   /* how long a trail patch lasts, ms */
        const SPOT = .6, TRAIL = .08;      /* opacity of the patch, and of a fresh trail patch */
        const WAVE = .55, BAND = 60, WAVE_LIFE = 1800, SPEED = .55;  /* a click: opacity, width (px), length (ms) and speed (px/ms) of the wave */
        const BOUNCES = 3, ECHO = .7;       /* how many times it comes back from a dam, and how much of it is left each time */
        const DAMS = '.nav, .hero, .hero-about, .sec, .block, .chat, .foot, .cells > *, .cols2 > div';
        const PULSE = 1500;                 /* one letter fades out and back, ms */
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

        const canvas = document.createElement('canvas');
        canvas.className = 'bg-letters';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        /* the patch: drawn once, then stamped wherever it is needed */
        const spot = document.createElement('canvas');
        spot.width = spot.height = D * 2;
        const s = spot.getContext('2d');
        const glow = s.createRadialGradient(D, D, 0, D, D, D);
        glow.addColorStop(0, 'rgba(0,0,0,1)');
        glow.addColorStop(.5, 'rgba(0,0,0,.55)');
        glow.addColorStop(.8, 'rgba(0,0,0,.12)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        s.fillStyle = glow;
        s.fillRect(0, 0, D * 2, D * 2);

        /* each letter of HnM in each colour, at twice its size so it stays sharp */
        const css = getComputedStyle(root);
        const font = '400 11px ' + getComputedStyle(document.body).fontFamily;
        const probe = document.createElement('canvas').getContext('2d');
        probe.font = font;
        let TW = 2;
        const glyphs = [...'HnM'].map(letter => {
            const w = Math.ceil(probe.measureText(letter).width);
            const at = TW - 2;
            TW += w;
            return {
                w, at,
                letter,
                tiles: ['--title', '--accent', '--ink'].map(() => {
                    const tile = document.createElement('canvas');
                    tile.width = w * 2;
                    tile.height = ROW * 2;
                    return tile;
                })
            };
        });
        const tint = () => glyphs.forEach(g => g.tiles.forEach((tile, i) => {
            const t = tile.getContext('2d');
            t.setTransform(2, 0, 0, 2, 0, 0);
            t.clearRect(0, 0, g.w, ROW);
            t.font = font;
            t.textBaseline = 'middle';
            t.fillStyle = css.getPropertyValue(['--title', '--accent', '--ink'][i]).trim();
            t.fillText(g.letter, 0, ROW / 2);
        }));
        tint();

        /* the letters of this moment are set here, then cut to the shape of the patches on the screen */
        const layer = document.createElement('canvas');
        const lc = layer.getContext('2d');

        let dpr = 1;
        const fit = () => {
            dpr = devicePixelRatio || 1;
            canvas.width = layer.width = innerWidth * dpr;
            canvas.height = layer.height = innerHeight * dpr;
            lc.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const setLetters = (now, x0, y0, x1, y1) => {
            lc.clearRect(0, 0, innerWidth, innerHeight);
            const top = scrollY;
            /* with a wave out the whole screen is walked, but only the words under it or under a patch are set */
            const from = rings.length ? 0 : x0, to = rings.length ? innerWidth : x1;
            const upper = rings.length ? 0 : y0, lower = rings.length ? innerHeight : y1;
            for (let r = Math.floor((upper + top) / ROW); r * ROW - top < Math.min(lower, innerHeight); r++) {
                for (let c = Math.max(0, Math.floor(from / TW)); c * TW < Math.min(to, innerWidth); c++) {
                    const wx = c * TW, wy = r * ROW - top;
                    const inPatch = wx + TW > x0 && wx < x1 && wy + ROW > y0 && wy < y1;
                    if (!inPatch && !rings.some(w => {
                        if (wx + TW < w.x0 || wx > w.x1 || wy + ROW < w.y0 || wy > w.y1) return false;
                        const d = Math.hypot(wx + TW / 2 - w.x, wy + ROW / 2 - w.y);
                        return d > w.inner - TW && d < w.out + TW;
                    })) continue;
                    glyphs.forEach((g, i) => {
                        /* every letter has its own moment in the pulse; it changes colour while it is unseen */
                        const h = (((c * 3 + i) * 73856093) ^ (r * 19349663)) >>> 0;
                        const at = now / PULSE + (h % 1000) / 1000;
                        const round = Math.floor(at);
                        lc.globalAlpha = still ? 1 : Math.min(1, Math.sin((at - round) * Math.PI) * 1.5);
                        lc.drawImage(g.tiles[still ? 0 : (round + h) % 3], wx + g.at, wy, g.w, ROW);
                    });
                }
            }
        };

        /* the room a click happens in: the nearest dam on each side, measured on the page. A side without one stays open */
        const room = (cx, py) => {
            const top = scrollY, walls = { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity };
            document.querySelectorAll(DAMS).forEach(el => {
                const q = el.getBoundingClientRect();
                if (!q.width || !q.height) return;
                const cs = getComputedStyle(el);
                const drawn = side => parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none';
                if (cx >= q.left && cx <= q.right) {
                    [['Top', q.top + top], ['Bottom', q.bottom + top]].forEach(([side, at]) => {
                        if (!drawn(side)) return;
                        if (at > py) walls.bottom = Math.min(walls.bottom, at); else walls.top = Math.max(walls.top, at);
                    });
                }
                if (py >= q.top + top && py <= q.bottom + top) {
                    [['Left', q.left], ['Right', q.right]].forEach(([side, at]) => {
                        if (!drawn(side)) return;
                        if (at > cx) walls.right = Math.min(walls.right, at); else walls.left = Math.max(walls.left, at);
                    });
                }
            });
            return walls;
        };

        /* a wave coming back from a dam looks like a wave from the mirror image of the click behind that dam */
        const mirrors = (at, lo, hi) => {
            const list = [{ at, bounced: 0 }];
            [[lo, hi], [hi, lo]].forEach(([first, second]) => {
                let pos = at, wall = first;
                for (let n = 1; n <= BOUNCES && Number.isFinite(wall); n++) {
                    pos = 2 * wall - pos;
                    list.push({ at: pos, bounced: n });
                    wall = wall === first ? second : first;
                }
            });
            return list;
        };

        const trail = [], waves = [];
        let rings = [];
        let lastTop = scrollY;
        let x = 0, y = 0, tx = 0, ty = 0, since = 0, show = 0, showGoal = 0, raf = 0, idle = 0, started = false;

        const draw = now => {
            raf = 0;
            const dx = (tx - x) * (still ? 1 : .35), dy = (ty - y) * (still ? 1 : .35);
            const moved = Math.hypot(dx, dy);
            if (!still && moved) {
                /* patches are laid at an even distance along the way, however fast the mouse went */
                for (let d = GAP - since; d < moved; d += GAP) {
                    trail.push({ x: x + dx * d / moved, y: y + dy * d / moved, t: now });
                }
                since = (since + moved) % GAP;
            }
            x += dx; y += dy;
            if (Math.hypot(tx - x, ty - y) < .1) { x = tx; y = ty; }

            /* scrolling: what was left behind stays on the page, and the way the mouse went over the page is laid like any other */
            const flowed = scrollY - lastTop;
            lastTop = scrollY;
            if (flowed) {
                trail.forEach(c => { c.y -= flowed; });
                if (!still && show) {
                    const way = Math.abs(flowed);
                    for (let d = GAP - since; d < way; d += GAP) {
                        trail.push({ x, y: y - Math.sign(flowed) * (way - d), t: now });
                    }
                    since = (since + way) % GAP;
                }
            }
            show += (showGoal - show) * (still ? 1 : .2);
            if (Math.abs(showGoal - show) < .01) show = showGoal;
            while (trail.length && now - trail[0].t > LIFE) trail.shift();
            while (waves.length && now - waves[0].t > WAVE_LIFE) waves.shift();

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            const reach = (cx, cy, r) => {
                x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r);
                x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r);
            };
            const stamp = (cx, cy, size, alpha) => {
                reach(cx, cy, D * size / 2);
                ctx.globalAlpha = alpha;
                ctx.drawImage(spot, cx - D * size / 2, cy - D * size / 2, D * size, D * size);
            };
            trail.forEach(c => {
                const left = 1 - (now - c.t) / LIFE;
                stamp(c.x, c.y, .5 + left * .5, TRAIL * left * show);
            });
            if (show) stamp(x, y, 1, SPOT * show);

            /* a wave is a soft ring that widens and fades, drawn together with its echoes and kept inside its room */
            rings = [];
            const top = scrollY;
            waves.forEach(w => {
                const age = Math.max(0, now - w.t);
                const r = age * SPEED, out = r + BAND, inner = Math.max(0, r - BAND);
                const x0r = Math.max(w.room.left, 0), x1r = Math.min(w.room.right, innerWidth);
                const y0r = Math.max(w.room.top - top, 0), y1r = Math.min(w.room.bottom - top, innerHeight);
                if (x1r <= x0r || y1r <= y0r) return;
                ctx.save();
                ctx.beginPath();
                ctx.rect(x0r, y0r, x1r - x0r, y1r - y0r);
                ctx.clip();
                w.xs.forEach(ix => w.ys.forEach(iy => {
                    const alpha = WAVE * (1 - age / WAVE_LIFE) * Math.pow(ECHO, ix.bounced + iy.bounced);
                    const cx = ix.at, cy = iy.at - top;
                    const near = Math.hypot(cx - Math.max(x0r, Math.min(x1r, cx)), cy - Math.max(y0r, Math.min(y1r, cy)));
                    const far = Math.hypot(Math.max(cx - x0r, x1r - cx), Math.max(cy - y0r, y1r - cy));
                    if (alpha < .02 || out < near || inner > far) return;
                    const ring = ctx.createRadialGradient(cx, cy, inner, cx, cy, out);
                    ring.addColorStop(0, 'rgba(0,0,0,0)');
                    ring.addColorStop((r - inner) / (out - inner), 'rgba(0,0,0,1)');
                    ring.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = ring;
                    ctx.fillRect(x0r, y0r, x1r - x0r, y1r - y0r);
                    rings.push({ x: cx, y: cy, inner, out, x0: x0r, y0: y0r, x1: x1r, y1: y1r });
                }));
                ctx.restore();
            });

            /* the letters show only where something was laid */
            setLetters(now, x0, y0, x1, y1);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.save();
            /* only the part of the screen in use, not all of it */
            if (!rings.length && x1 > x0) {
                ctx.beginPath();
                ctx.rect(x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
                ctx.clip();
            }
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(layer, 0, 0);
            ctx.restore();

            if (trail.length || waves.length || x !== tx || y !== ty || show !== showGoal) wake();
            else if (show && !still) idle = setTimeout(wake, 40);    /* at rest only the letters move, which needs fewer frames */
        };
        const wake = () => {
            clearTimeout(idle);
            if (!raf) raf = requestAnimationFrame(draw);
        };

        addEventListener('pointermove', e => {
            if (e.pointerType !== 'mouse') return;
            tx = e.clientX; ty = e.clientY;
            if (!started) { started = true; x = tx; y = ty; }
            showGoal = 1;
            wake();
        }, { passive: true });
        addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse' || still) return;
            const py = e.clientY + scrollY, walls = room(e.clientX, py);
            waves.push({ t: performance.now(), room: walls, xs: mirrors(e.clientX, walls.left, walls.right), ys: mirrors(py, walls.top, walls.bottom) });
            wake();
        }, { passive: true });
        /* the mouse left the window: the patch fades out and comes back where the mouse returns */
        root.addEventListener('mouseleave', () => { showGoal = 0; started = false; wake(); });
        addEventListener('scroll', wake, { passive: true });
        addEventListener('resize', () => { fit(); wake(); });
        root.addEventListener('themechange', () => { tint(); wake(); });
        fit();
    }

    /* ---------- the footer: Hanoi, with the letters h, n, m as its pixels. Only two buildings: Tháp Rùa in Hoàn Kiếm lake
       and the city post office across the water, behind a line of trees. Rain in light mode, fireworks in dark mode ---------- */
    const foot = document.querySelector('.foot');
    if (foot) {
        const scene = document.createElement('canvas');
        scene.setAttribute('aria-hidden', 'true');
        foot.prepend(scene);
        const STEP = 140;                   /* time between two frames, ms; slow on purpose, it should step like pixels */
        const CLOUDS = 5;
        const DROPS = 1 / 28;               /* raindrops per letter of sky */
        const RIPPLE = 1.5;                 /* how long a ring lasts on the lake, s */
        const SHELLS = 4;                   /* fireworks in the air, each on its own cycle */
        const SPARKS = 34;
        const CLIMB = .9, BURST = 2;        /* a shell's way up and its bloom, s */
        const DAY = {
            pane: '#c4c4c4', roof: '#761f21', stone: '#5f5354', dark: '#d9d6cf', plinth: '#6e6465', leaf: ['#4d6b4f', '#3e5a48'], bark: '#504141', steel: '#3f3233', water: '#83a096',
            flag: '#d91b24', star: '#f6e09a', sky: ['#bcbbbb', '#b5b4b5', '#adadaf', '#a6a6a9'], cloud: '#a8a7a9', shade: '#99989b', rain: '#4f6570', ripple: '#e6e4de'
        };
        const NIGHT = {
            roof: '#5b2a2c', stone: '#a39a8c', dark: '#e8c078', plinth: '#54464a', leaf: ['#2f4034', '#2a3a30'], bark: '#3f3437', steel: '#85747a', glass: '#e8c078', water: '#34464a', glint: '#e8e4da',
            flag: '#d91b24', star: '#e8c078', sky: ['#2a2224', '#33282a', '#472729', '#62292b'], moon: '#e8e4da', lamp: '#c4c4c4', panes: ['#e8c078', '#e8c078', '#c4c4c4', '#d91b24'],
            bloom: [['#d91b24', '#e8c078'], ['#e8c078', '#e8e4da'], ['#e8e4da', '#ef4a50'], ['#83a096', '#e8e4da']]
        };
        /* drawn by hand: each character is a colour of the palette above, s = stone, a = dark openings, r = roof, p = plinth, g = leaves */
        const THAP_RUA = [
            '...........r...........',
            '..........rrr..........',
            '.........rrrrr.........',
            '........rrrrrrr........',
            '.........sssss.........',
            '.........sasas.........',
            '.........sssss.........',
            '.......sssssssss.......',
            '.......rrrrrrrrr.......',
            '........sssssss........',
            '........sasasas........',
            '........sasasas........',
            '........sssssss........',
            '.....rrrrrrrrrrrrr.....',
            '.....s.s.s.s.s.s.s.....',
            '......sssssssssss......',
            '......saasaaasaas......',
            '......saasaaasaas......',
            '......saasaaasaas......',
            '......sssssssssss......',
            '...ppppppppppppppppp...',
            '.ggggggggggggggggggggg.',
            'ggggggggggggggggggggggg'
        ];
        const KEYS = t => ({ s: t.stone, a: t.dark, r: t.roof, p: t.plinth, g: t.leaf[0] });
        const LETTERS = 'hHnNmM';
        const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   /* fades the rays in an even pattern, as pixel art does */
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isNight = () => root.dataset.theme === 'dark';
        const noise = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
        const letter = (x, y) => LETTERS[noise(x + .5, y + .5) * 6 | 0];
        const dither = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;

        const ctx = scene.getContext('2d');
        const base = document.createElement('canvas');      /* what does not move */
        const bg = base.getContext('2d');
        let CW, CH, W, H, C, R, city, panes, stars, clouds, drops, skyTop, moonX, moonY, moonR, shore, rise, quiet, left, isle, timer;

        const hanoi = tone => {
            let seed = 7;
            const rand = () => noise(seed++, 3.7);
            const put = (x, y, paint) => { if (x >= 0 && x < C && y >= 0 && y < R) city[y * C + x] = paint; };
            const sprite = (rows, x0, bottom, size = 1) => {
                const keys = KEYS(tone), tall = Math.round(rows.length * size), wide = Math.round(rows[0].length * size);
                for (let y = 0; y < tall; y++) for (let x = 0; x < wide; x++) {
                    const k = rows[y / size | 0][x / size | 0];
                    if (k !== '.') put(x0 + x, bottom - tall + 1 + y, keys[k]);
                }
            };

            /* the post office: a long block of narrow windows, the clock tower rising from it */
            const narrow = C < 100;
            const postOffice = (x0, wide, tall) => {
                const wing = Math.round(tall * .56), tw = Math.max(9, wide * .2 | 0) | 1, tx = x0 + (wide * .34 | 0), top = shore - tall;
                for (let y = shore - wing; y < shore; y++) for (let x = x0; x < x0 + wide; x++) {
                    const row = y - shore + wing;
                    put(x, y, row === 0 ? tone.steel : row % 4 && (x - x0) % 3 ? 'pane' : tone.stone);
                }
                for (let y = top; y < shore; y++) for (let i = 0; i < tw; i++) {
                    const row = y - top;
                    put(tx + i, y, row === 0 ? tone.steel : row > 7 && i % 2 && row % 5 ? 'pane' : tone.stone);
                }
                /* the clock, near the top of the tower */
                const cx = tx + (tw >> 1);
                for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
                    if (Math.hypot(x / 3.4, y / 2.4) < 1) put(cx + x, top + 4 + y, tone.dark);
                }
                put(cx, top + 3, tone.steel); put(cx, top + 4, tone.steel); put(cx + 1, top + 4, tone.steel); put(cx + 2, top + 4, tone.steel);
                for (let i = 1; i < 7; i++) put(cx, top - i, tone.steel);
                for (let y = 4; y < 7; y++) for (let x = 1; x < 6; x++) put(cx + x, top - y, tone.flag);
                put(cx + 3, top - 5, tone.star);
            };
            postOffice(C * (narrow ? .4 : .46) | 0, C * (narrow ? .58 : .4) | 0, Math.min(rise * .86, C * .4) | 0);
            /* Tháp Rùa's place on the far bank stays open, so it stands against the sky */
            const tower = narrow ? C * .05 | 0 : C * .2 | 0, size = narrow ? .8 : 1, tw = Math.round(THAP_RUA[0].length * size);
            const open = x => x > tower && x < tower + tw;
            isle = [tower - 3, tower + tw + 3];

            /* a willow on the left, its strands falling to the water */
            const crown = (cx, bottom, rx, ry) => {
                for (let y = bottom - ry * 2; y <= bottom; y++) for (let x = cx - rx; x <= cx + rx; x++) {
                    const d = Math.hypot((x - cx) / rx, (y - bottom + ry) / ry);
                    if (d < .85 + noise(x, y) * .3) put(x, y, tone.leaf[noise(y, x) * 2 | 0]);
                }
            };
            for (let x = 3; x < C + 2;) {
                const rx = 3 + rand() * 3 | 0, ry = 2 + rand() | 0;
                if (!open(x - rx) && !open(x + rx)) {
                    put(x, shore - 1, tone.bark);
                    crown(x, shore - 2, rx, ry);
                }
                x += rx * 2 + 4 + (rand() * 6 | 0);
            }
            crown(5, shore - 8, 8, 3);
            for (let y = shore - 7; y < shore; y++) put(5, y, tone.bark);
            for (let x = -3; x < 15; x += 2) {
                const end = shore - 4 + noise(x, 1) * 6 | 0;
                for (let y = shore - 9; y < end; y++) if (noise(x, y) < .8) put(x, y, tone.leaf[(x & 2) >> 1]);
            }

            /* Tháp Rùa on its island, in the lake */
            sprite(THAP_RUA, tower, R - 2, size);
        };

        const makeClouds = top => {
            let seed = 41;
            const rand = () => noise(seed++, 9.1);
            const size = Math.min(1, C / 110);
            clouds = Array.from({ length: CLOUDS }, (_, i) => {
                const w = (14 + rand() * 12) * size | 0, cells = [];
                const puffs = Array.from({ length: 5 }, (_, p) => ({ x: w * (.14 + p * .18), y: 0, r: (.1 + .17 * Math.sin(Math.PI * (p + .5) / 5) + rand() * .05) * w }));
                const tall = Math.ceil(w * .22);
                for (let y = 0; y < tall; y++) for (let x = 0; x < w; x++) {
                    /* flat underneath, round on top */
                    const up = (tall - y) * CH / CW;
                    if (puffs.some(p => Math.hypot(x - p.x, up) < p.r)) cells.push([x, y, y >= tall - 2]);
                }
                return { w, cells, y: top + (i * 3 % CLOUDS) / CLOUDS * Math.max(4, shore * .22) | 0, x: i / CLOUDS * (C + w) + rand() * 14, v: .12 + rand() * .2 };
            });
        };

        const build = () => {
            W = foot.clientWidth;
            H = foot.clientHeight;
            /* one pixel = one letter; finer on a phone so the picture keeps its detail */
            const fine = W < 760;
            CW = fine ? 6 : 9;
            CH = fine ? 8 : 12;
            const dpr = Math.min(devicePixelRatio || 1, 2);
            for (const [c, g] of [[scene, ctx], [base, bg]]) {
                c.width = W * dpr;
                c.height = H * dpr;
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                g.font = `700 ${CH}px ui-monospace, Menlo, monospace`;
                g.textBaseline = 'top';
            }
            C = Math.ceil(W / CW);
            R = Math.ceil(H / CH);
            shore = R - Math.max(18, R * .36 | 0);
            /* on a phone the footer's text fills the width, so the sky under it is all the picture has */
            const lines = [...foot.querySelectorAll('p')], box = foot.getBoundingClientRect();
            const text = Math.ceil((lines[lines.length - 1].getBoundingClientRect().bottom - box.top) / CH);
            rise = fine ? shore - text - 2 : shore;
            skyTop = fine ? text + 1 : 1;
            /* the footer's text keeps a clear box: no letter of the picture is ever set inside it */
            const from = Math.floor((lines[0].getBoundingClientRect().top - box.top) / CH) - 1;
            const wide = Math.max(...lines.map(p => { const r = document.createRange(); r.selectNodeContents(p); return r.getBoundingClientRect().right - box.left; })) + 16;
            quiet = (x, y) => y >= from && y <= text && x * CW < wide;
            left = fine ? 0 : Math.ceil(wide / CW);
            moonX = C * .8;
            moonR = Math.min(R * .13, C * .09);
            moonY = fine ? text + moonR + 2 : R * .2;
            const night = isNight(), tone = night ? NIGHT : DAY;
            city = new Array(C * R).fill(null);
            hanoi(tone);

            panes = [];
            stars = [];
            for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
                if (quiet(x, y)) { city[y * C + x] = null; continue; }
                let paint = city[y * C + x];
                if (paint === 'pane') {
                    if (night) { if (noise(x, y) < .62) panes.push([x, y, NIGHT.panes[noise(y, x) * 4 | 0], noise(x * 2, y * 3)]); continue; }
                    paint = noise(x, y) < .4 ? DAY.pane : null;
                } else if (!paint && y < shore) {
                    const dx = (x - moonX) * CW / CH, dy = y - moonY, r = Math.hypot(dx, dy);
                    if (night && r < moonR && Math.hypot(dx - moonR * .5, dy + moonR * .15) > moonR * .85) paint = NIGHT.moon;
                    else if (night && y < R * .7 && noise(x, y * 2) < .012) { stars.push([x, y, noise(y, x)]); continue; }
                    else if (y >= skyTop && noise(x, y) < (night ? .42 : .2)) {
                        /* the sky warms toward the street lights at night, darkens toward the rain by day, in steps */
                        const glow = (y / shore) ** 2.2 * 3.6 + noise(y, x) * .8;
                        paint = tone.sky[Math.min(3, glow | 0)];
                    }
                }
                if (paint) { bg.fillStyle = paint; bg.fillText(letter(x, y), x * CW, y * CH); }
            }
            if (!night) {
                makeClouds(skyTop);
                const span = shore - skyTop;
                drops = Array.from({ length: C * span * DROPS | 0 }, (_, i) => ({ x: noise(i, 1.3) * C, at: noise(i, 2.9) * span, v: 13 + noise(i, 4.1) * 7 }));
            }
            draw(still ? 1.7 : performance.now() / 1000);
        };

        /* rain falls slantwise out of the clouds in streaks, past the post office's windows, and stops at the far bank */
        const rain = t => {
            const over = new Int8Array(C * R), span = shore - skyTop;
            for (const c of clouds) {
                const from = Math.floor((c.x + t * c.v) % (C + c.w)) - c.w;
                for (const [x, y, low] of c.cells) if (from + x >= 0 && from + x < C) over[(c.y + y) * C + from + x] = low ? 2 : 1;
            }
            ctx.fillStyle = DAY.rain;
            for (const d of drops) {
                const head = skyTop + (d.at + t * d.v) % span | 0;
                for (let k = 0; k < 6; k++) {
                    const y = head - k, x = ((d.x - y * .3) % C + C) % C | 0, at = y * C + x;
                    if (y < skyTop || y >= shore || (city[at] && city[at] !== 'pane') || over[at] || quiet(x, y)) continue;
                    ctx.globalAlpha = 1 - k * .15;
                    ctx.fillText(letter(x, y), x * CW, y * CH);
                }
            }
            ctx.globalAlpha = 1;
            for (let y = 0; y < shore; y++) for (let x = 0; x < C; x++) {
                const at = y * C + x;
                if (!over[at] || city[at] || quiet(x, y)) continue;
                ctx.fillStyle = over[at] === 1 ? DAY.cloud : DAY.shade;
                ctx.fillText(letter(x, y), x * CW, y * CH);
            }
        };

        /* where the rain meets the lake: a flat ring that opens and thins out */
        const ripples = t => {
            ctx.fillStyle = DAY.ripple;
            for (let i = 0, n = C / 6 | 0; i < n; i++) {
                const age = t / RIPPLE + noise(i, 6.3) * 9, round = Math.floor(age), u = age - round;
                const cx = noise(i, round) * C, cy = shore + 1 + noise(round, i) * (R - shore - 2), r = 1 + u * 5;
                for (let a = 0; a < 14; a++) {
                    const x = cx + Math.cos(a * Math.PI / 7) * r * CH / CW | 0, y = cy + Math.sin(a * Math.PI / 7) * r * .32 | 0;
                    if (x < 0 || x >= C || y >= R || city[y * C + x] || (x > isle[0] && x < isle[1]) || dither(x, y) > 1 - u) continue;
                    ctx.fillText(letter(x, y), x * CW, y * CH);
                }
            }
        };

        const lights = t => {
            /* a star comes and goes; a window changes every so often */
            ctx.fillStyle = NIGHT.lamp;
            for (const [x, y, p] of stars) if (Math.sin(t * (.5 + p) + p * 40) > -.35) ctx.fillText(letter(x, y), x * CW, y * CH);
            for (const [x, y, paint, p] of panes) {
                if (noise(p * 90, Math.floor(t / (9 + p * 30) + p * 7)) < .2) continue;
                ctx.fillStyle = paint;
                ctx.fillText(letter(x, y), x * CW, y * CH);
            }
        };

        /* fireworks over the lake: a shell climbs from behind the trees, opens in two colours, sags and fades.
           Each spark also shows in the water */
        const spark = (x, y, paint) => {
            x |= 0; y |= 0;
            if (x < 0 || x >= C || y < skyTop || y >= shore || city[y * C + x] || quiet(x, y)) return;
            ctx.fillStyle = paint;
            ctx.fillText(letter(x, y), x * CW, y * CH);
            const down = shore + (shore - y) * (R - shore) / shore | 0;
            if (down < R && !city[down * C + x] && noise(x + down, Math.floor(y / 2)) < .5) {
                ctx.globalAlpha = .4;
                ctx.fillText(letter(x, down), x * CW, down * CH);
                ctx.globalAlpha = 1;
            }
        };
        const fireworks = t => {
            const size = Math.min(rise * .3, C * .1), wide = CH / CW;
            for (let i = 0; i < SHELLS; i++) {
                const cycle = CLIMB + BURST + 1.1 + i * .6, age = t / cycle + i * .27, round = Math.floor(age), now = (age - round) * cycle;
                const from = left + size * wide, x = from + noise(round, i + 1) * (C - size * wide - from);
                const y = skyTop + size * (1 + noise(i + 1, round)) * .9;
                const [one, two] = NIGHT.bloom[(round + i) % NIGHT.bloom.length];
                if (now < CLIMB) {
                    const head = shore + (y - shore) * (now / CLIMB) ** .6;
                    for (let k = 0; k < 3; k++) spark(x + Math.sin(head + k) * .6, head + k * 2, k ? two : one);
                } else if (now < CLIMB + BURST) {
                    const u = (now - CLIMB) / BURST, open = 1 - (1 - u) ** 3;
                    for (let k = 0; k < SPARKS; k++) {
                        const inner = k & 1, a = (k + noise(k, round) * .6) / SPARKS * Math.PI * 2;
                        const reach = size * (inner ? .55 : .95 + noise(round, k) * .2) * open;
                        const sx = x + Math.cos(a) * reach * wide, sy = y + Math.sin(a) * reach + u * u * 5;
                        if (dither(sx | 0, sy | 0) > 1.15 - u * u) continue;
                        spark(sx, sy, inner ? two : one);
                        if (u < .55) spark(x + Math.cos(a) * reach * .8 * wide, y + Math.sin(a) * reach * .8 + u * u * 5, two);
                    }
                }
            }
        };

        /* the lake: small letters of water, with the city and the moon broken up in it */
        const lake = (t, tone) => {
            const now = Math.floor(t * 1.2);
            for (let y = shore; y < R; y++) {
                const wave = (noise(y, now) * 3 | 0) - 1, from = (2 * shore - 1 - y) * C;
                for (let x = 0; x < C; x++) {
                    if (city[y * C + x]) continue;
                    const up = city[from + x + wave];
                    const paint = up === 'pane' ? (tone === NIGHT ? tone.glass : null) : up;
                    if (tone === NIGHT && Math.abs(x - moonX - wave * 2) < moonR * (CH / CW) * (1 - (y - shore) / (R - shore) * .4) && dither(x + wave, y) < .22) {
                        ctx.fillStyle = tone.glint;
                    } else if (paint && noise(x + now, y) < .3) {
                        ctx.globalAlpha = .4;
                        ctx.fillStyle = paint;
                    } else if (!(x > isle[0] && x < isle[1]) && noise(Math.floor((x + y * 5 + now * (y & 1 ? 1 : -1)) / 7), y) < (tone === NIGHT ? .22 : .13)) {
                        /* long flat strokes, not specks, read as water */
                        ctx.fillStyle = tone.water;
                    } else continue;
                    ctx.fillText(letter(x, y), x * CW, y * CH);
                    ctx.globalAlpha = 1;
                }
            }
        };

        function draw(t) {
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(base, 0, 0, W, H);
            const tone = isNight() ? NIGHT : DAY;
            (tone === NIGHT ? lights : rain)(t);
            lake(t, tone);
            (tone === NIGHT ? fireworks : ripples)(t);
        }

        const tick = () => {
            draw(performance.now() / 1000);
            timer = setTimeout(tick, STEP);
        };
        if (!still) new IntersectionObserver(([e]) => {
            clearTimeout(timer);
            if (e.isIntersecting) tick();
        }).observe(scene);
        new ResizeObserver(build).observe(foot);
        root.addEventListener('themechange', build);
        root.addEventListener('langchange', build);
    }

    /* ---------- home: three clicks on the part of the hero that holds the name, and the red full stop becomes a stick figure.
       A and D walk, Space jumps, and each further Space in the air pushes it higher. It stands on the line under the name,
       and the letters of "Hnam" are solid ground: their tops are read from the letters themselves.
       Three more clicks and it curls back into the full stop. Measures are in units of the dot's radius, so it fits the type at every width. ---------- */
    const heroBox = document.querySelector('.hero');
    if (heroBox && heroBox.querySelector('.wordmark i') && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const word = heroBox.querySelector('.wordmark'), dot = word.querySelector('i');
        const about = heroBox.querySelector('.hero-about'), photo = heroBox.querySelector('.img');
        const SIZE = .5, HEAD = .78, BODY = 1.8, LEG = 1.9, ARM = 1.6, LINE = .4, HALF = .35, STEP = .7;   /* the figure against the dot, then head radius, neck to hip, each limb's two parts together, stroke; half the feet's width and the highest edge it walks over, in plain radii */
        const SPEED = 15, GRAVITY = 85, JUMP = 27, TOP = 2.3;                                      /* per second; TOP = how many jumps' worth of speed it can hold at once */
        const MORPH = .55, HOME = .6;
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const canvas = document.createElement('canvas');
        canvas.className = 'stick';
        const ctx = canvas.getContext('2d');
        const keys = { left: false, right: false };
        let on = false, W = 0, H = 0, r = 26, colour = '', tops = [], rest = { x: 0, y: 0 };
        let x = 0, y = 0, vx = 0, vy = 0, face = 1, ground = false;
        let grow = 0, stride = 0, run = 0, air = 0, dip = 0, leaving = null, last = 0, frame = 0;

        /* the top of the ground at each column of the canvas: the letters, drawn where the page has them, or the line under the name */
        function survey() {
            const box = heroBox.getBoundingClientRect();
            W = Math.round(photo.getBoundingClientRect().left - box.left);
            H = Math.round(about.getBoundingClientRect().top - box.top);
            const scale = devicePixelRatio || 1;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            canvas.width = W * scale;
            canvas.height = H * scale;
            ctx.setTransform(scale, 0, 0, scale, 0, 0);

            /* a box of no height sits on the baseline */
            const probe = document.createElement('span');
            probe.style.cssText = 'display:inline-block;width:0;height:0';
            dot.prepend(probe);
            const base = probe.getBoundingClientRect();
            probe.remove();
            const baseline = base.bottom - box.top;

            const css = getComputedStyle(word);
            const font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
            const map = document.createElement('canvas');
            map.width = W;
            map.height = H;
            const m = map.getContext('2d', { willReadFrequently: true });
            m.font = font;
            m.textBaseline = 'alphabetic';
            const text = word.firstChild, range = document.createRange();
            [...text.textContent].forEach((letter, i) => {
                range.setStart(text, i);
                range.setEnd(text, i + 1);
                m.fillText(letter, range.getBoundingClientRect().left - box.left, baseline);
            });

            const ink = m.measureText('.');
            r = (ink.actualBoundingBoxRight + ink.actualBoundingBoxLeft) / 2;
            rest = { x: base.left - box.left + (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2, y: baseline };

            const px = m.getImageData(0, 0, W, H).data;
            tops = Array.from({ length: W }, (_, col) => {
                for (let row = 0; row < H; row++) if (px[(row * W + col) * 4 + 3] > 128) return row;
                return H;
            });
            colour = getComputedStyle(dot).color;
        }

        /* the highest ground under the feet */
        const groundAt = at => {
            let top = H;
            const a = Math.max(0, Math.floor(at - HALF * r)), b = Math.min(W - 1, Math.ceil(at + HALF * r));
            for (let col = a; col <= b; col++) top = Math.min(top, tops[col]);
            return top;
        };

        function move(dt) {
            const wish = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            vx += (wish * SPEED * r - vx) * Math.min(1, dt * 14);
            if (wish) face = wish;

            const next = Math.min(W - HALF * r, Math.max(HALF * r, x + vx * dt));
            const top = groundAt(next);
            if (y - top <= STEP * r) {
                stride += (next - x) * face / r;
                x = next;
            } else vx = 0;   /* a letter stands in the way: jump */

            vy += GRAVITY * r * dt;
            y += vy * dt;
            const floor = groundAt(x);
            const height = (BODY + 2 * HEAD + LEG) * SIZE * r;
            if (y - height < 0 && vy < 0) { y = height; vy = 0; }   /* the header is the ceiling */
            if (ground && vy >= 0 && floor - y <= STEP * r) y = floor;   /* walking down a curve, not falling off it */
            if (y >= floor) {
                if (!ground) dip = Math.min(1, vy / (JUMP * r));
                y = floor;
                vy = 0;
                ground = true;
            } else ground = y === floor;

            run += (Math.min(1, Math.abs(vx) / (SPEED * r)) - run) * Math.min(1, dt * 12);
            air += ((ground ? 0 : 1) - air) * Math.min(1, dt * 14);
            dip = Math.max(0, dip - dt * 6);
        }

        /* a limb of two parts from a joint: `swing` turns the whole limb, `bend` the lower part */
        const limb = (ax, ay, len, swing, bend, f) => {
            const kx = ax + Math.sin(swing) * f * len / 2, ky = ay + Math.cos(swing) * len / 2;
            const tip = swing + bend;
            ctx.moveTo(ax, ay);
            ctx.lineTo(kx, ky);
            ctx.lineTo(kx + Math.sin(tip) * f * len / 2, ky + Math.cos(tip) * len / 2);
        };

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const s = grow * SIZE * r;
            const swing = Math.sin(stride * .55) * .75 * run;
            const open = 1 - Math.max(run, air);   /* standing still: feet and arms apart, so two limbs do not read as one */
            const up = Math.max(-1, Math.min(1, -vy / (JUMP * r)));   /* 1 rising, -1 falling */
            const hip = y - LEG * s * (1 - .34 * air - .22 * dip) - LINE * s / 2;
            const neck = hip - BODY * s;
            const lean = (run * .16 + air * .05) * face * s;
            const headR = r + (HEAD * SIZE * r - r) * grow;
            const headY = neck - HEAD * s * 1.05 - headR * (1 - grow);
            const headX = x + lean * 2;

            ctx.strokeStyle = ctx.fillStyle = colour;
            ctx.lineWidth = LINE * s;
            ctx.lineCap = ctx.lineJoin = 'round';
            if (grow > .02) {
                ctx.beginPath();
                ctx.moveTo(x, hip);
                ctx.lineTo(x + lean * 1.6, neck);
                limb(x, hip, LEG * s, swing + open * .24 + air * .55, -(.08 + Math.max(0, swing) * .9) - air * .9, face);
                limb(x, hip, LEG * s, -swing - open * .24 + air * .1, -(.08 + Math.max(0, -swing) * .9) - air * .5, face);
                const reach = air * (1.2 + up * .9);
                limb(x + lean * 1.5, neck + .14 * s, ARM * s, -swing * .8 + open * .34 + reach, .3 + reach * .2, face);
                limb(x + lean * 1.5, neck + .14 * s, ARM * s, swing * .8 - open * .34 - reach * .7, -.3 * open + .3 * run - reach * .2, face);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(headX, headY, headR, 0, Math.PI * 2);
            ctx.fill();
        }

        function tick(now) {
            const dt = Math.min(.033, (now - last) / 1000);
            last = now;
            if (leaving) {
                const q = still ? 1 : Math.min(1, (now - leaving.t) / (HOME * 1000));
                const e = q * q * (3 - 2 * q);
                x = leaving.x + (rest.x - leaving.x) * e;
                y = leaving.y + (rest.y - leaving.y) * e - Math.sin(q * Math.PI) * 3 * r;
                grow = Math.min(grow, 1 - e);
                if (q === 1) return stop();
            } else {
                grow = still ? 1 : Math.min(1, grow + dt / MORPH);
                move(dt);
            }
            draw();
            frame = requestAnimationFrame(tick);
        }

        function start() {
            survey();
            on = true;
            leaving = null;
            x = rest.x;
            y = rest.y;
            vx = 0;
            vy = -JUMP * .6 * r;   /* a small hop off the baseline, in which the limbs grow */
            ground = false;
            grow = stride = run = air = dip = 0;
            face = -1;
            heroBox.appendChild(canvas);
            dot.style.visibility = 'hidden';
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }

        function stop() {
            on = false;
            leaving = null;
            keys.left = keys.right = false;
            cancelAnimationFrame(frame);
            canvas.remove();
            dot.style.visibility = '';
        }

        const nameArea = t => !t.closest('.img, .hero-about');
        /* the second and third click would otherwise select the word */
        heroBox.addEventListener('mousedown', e => { if (e.detail > 1 && nameArea(e.target)) e.preventDefault(); });
        heroBox.addEventListener('click', e => {
            if (e.detail !== 3 || !nameArea(e.target)) return;
            if (!on) start();
            else if (!leaving) leaving = { t: performance.now(), x, y };
        });

        /* by physical key, so it works in any keyboard layout and with Vietnamese typing on; the page keeps its keys once the hero is scrolled away */
        const KEYS = { KeyA: 'left', KeyD: 'right' };
        const playing = e => on && !leaving && !e.metaKey && !e.ctrlKey && !e.altKey && heroBox.getBoundingClientRect().bottom > innerHeight / 2;
        addEventListener('keydown', e => {
            if (e.code === 'Space' && playing(e)) {
                e.preventDefault();
                if (e.repeat) return;
                const push = JUMP * r;
                vy = vy < 0 ? Math.max(vy - push, -push * TOP) : -push;
                ground = false;
            } else if (KEYS[e.code] && playing(e)) {
                e.preventDefault();
                keys[KEYS[e.code]] = true;
            }
        });
        addEventListener('keyup', e => { if (KEYS[e.code]) keys[KEYS[e.code]] = false; });
        addEventListener('blur', () => { keys.left = keys.right = false; });

        new ResizeObserver(() => {
            if (!on) return;
            survey();
            x = Math.min(W - HALF * r, Math.max(HALF * r, x));
            y = Math.min(y, groundAt(x));
        }).observe(heroBox);
        root.addEventListener('themechange', () => { if (on) colour = getComputedStyle(dot).color; });
    }
})();
