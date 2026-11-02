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
       The archive's 125 full-size pieces are left out: they still arrive as each one nears the focus.
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
            from.querySelectorAll('[data-bg]').forEach(el => add(el.dataset.bg));
            from.querySelectorAll('img[data-full]').forEach(img => { if (!img.closest('#strip')) add(img.dataset.full); });
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
    }

    let saved = 'en';
    try { saved = localStorage.getItem('lang') || 'en'; } catch (e) { }
    setLang(saved);

    const langBtn = document.querySelector('.langbtn');
    if (langBtn) langBtn.addEventListener('click', () => setLang(root.lang === 'vi' ? 'en' : 'vi'));

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

    /* ---------- archive: an endless line of work across the middle of the screen.
       Scrolling runs the line from right to left, and it loops for ever. As a piece nears the focus point it grows,
       drifts above or below the line and overlaps its neighbours; past the focus it shrinks back into the line. ---------- */
    const strip = document.getElementById('strip');
    if (strip) {
        const stage = document.getElementById('arch-stage');
        const figs = [...strip.querySelectorAll('figure')];
        const num = document.getElementById('arch-n');
        const cap = document.getElementById('arch-cap');
        const N = figs.length;
        const BASE = 40;                                   /* height of a piece at rest, px */
        const GAP = 3;
        const DRIFT = [-1, .45, -.3, .95, -.75, .2, .7, -.5, 1, -.15, .55, -.9];   /* how far each piece wanders off the line */
        const pad = n => String(n).padStart(2, '0');
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* where each piece sits along the loop, measured to its centre */
        let L = 0;
        figs.forEach(f => {
            const img = f.querySelector('img');
            /* proportions from the width/height attributes: the image itself may not have loaded yet */
            f.bw = BASE * Number(img.getAttribute('width')) / Number(img.getAttribute('height'));
            f.at = L + f.bw / 2;
            L += f.bw + GAP;
        });

        let W = 0, H = 0, push = 0, reach = 0;
        let run = figs[0].at, goal = run;                  /* how far the line has run; starts with the first piece in focus */
        let fx = .5, fxGoal = .5;                          /* focus point, as a share of the width */
        let shown = -1, raf = 0;

        const size = () => {
            W = stage.clientWidth; H = stage.clientHeight;
            push = Math.min(260, W * .2);                  /* room the opened pieces take from the rest of the line */
            reach = Math.max(70, Math.min(130, W * .09));  /* how close to the focus a piece starts to open */
        };

        const draw = () => {
            const tall = Math.min(H * .46, 520);
            const focus = fx * W;
            let best = 0, bestNear = -1;
            figs.forEach((f, i) => {
                /* distance from the focus along the loop, wrapped so the line never ends */
                let d = (f.at - run) % L;
                if (d < -L / 2) d += L; else if (d >= L / 2) d -= L;
                const near = Math.exp(-(d * d) / (reach * reach));
                const x = focus + d + Math.tanh(d / (reach * 1.4)) * push;
                if (x < -700 || x > W + 700) { if (f.on !== false) { f.on = false; f.style.visibility = 'hidden'; } return; }
                if (!f.on) { f.on = true; f.style.visibility = ''; }
                const scale = 1 + near * (Math.min(tall / BASE, W * .62 / f.bw) - 1);
                const y = DRIFT[i % DRIFT.length] * H * .2 * near;
                /* real width and height, not a scale transform, so the opened piece stays sharp */
                if (scale !== f.sc) {
                    f.sc = scale;
                    f.style.width = f.bw * scale + 'px';
                    f.style.height = BASE * scale + 'px';
                    f.style.marginLeft = -f.bw * scale / 2 + 'px';
                    f.style.marginTop = -BASE * scale / 2 + 'px';
                }
                f.style.transform = 'translate(' + x + 'px,' + y + 'px)';
                f.style.zIndex = Math.round(near * 1000);
                f.classList.toggle('up', near > .15);
                if (near > .1) {
                    const img = f.querySelector('img');
                    if (img.dataset.full) { img.src = img.dataset.full; delete img.dataset.full; }
                }
                if (near > bestNear) { bestNear = near; best = i; }
            });
            if (best !== shown) {
                shown = best;
                num.textContent = pad(best + 1) + ' / ' + N;
                cap.textContent = figs[best].querySelector('figcaption').textContent;
            }
        };

        const tick = () => {
            raf = 0;
            const k = still ? 1 : .16;
            run += (goal - run) * k;
            fx += (fxGoal - fx) * k;
            if (Math.abs(goal - run) < .05) run = goal;
            if (Math.abs(fxGoal - fx) < .0005) fx = fxGoal;
            draw();
            if (run !== goal || fx !== fxGoal) raf = requestAnimationFrame(tick);
        };
        const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

        /* the wheel runs the line; it never reaches an end */
        stage.addEventListener('wheel', e => {
            e.preventDefault();
            goal += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            go();
        }, { passive: false });

        /* a phone has no wheel: there a sideways swipe is the scroll. A mouse cannot drag the line. */
        let dragX = null;
        stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') dragX = e.clientX; });
        addEventListener('pointerup', () => { dragX = null; });
        addEventListener('pointercancel', () => { dragX = null; });
        stage.addEventListener('pointermove', e => {
            if (dragX !== null) {
                goal -= (e.clientX - dragX) * 1.4; dragX = e.clientX; go();
                return;
            }
            /* a mouse resting on the line moves the point where the pieces open */
            if (e.pointerType !== 'mouse') return;
            const r = stage.getBoundingClientRect();
            if (Math.abs(e.clientY - (r.top + r.height / 2)) < 44) {
                fxGoal = Math.max(.15, Math.min(.85, (e.clientX - r.left) / r.width)); go();
            }
        });
        stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { fxGoal = .5; go(); } });

        strip.addEventListener('keydown', e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = figs[(shown + (e.key === 'ArrowRight' ? 1 : N - 1)) % N];
            /* go to the neighbour by the short way round the loop */
            let d = (next.at - goal) % L;
            if (d < -L / 2) d += L; else if (d >= L / 2) d -= L;
            goal += d; go();
        });
        addEventListener('resize', () => { size(); draw(); });

        size();
        draw();
    }

    /* ---------- certificates: a click opens the paper large, over the blurred page.
       A grouped certificate opens its whole set first; picking one from the set shows that one large. ---------- */
    const box = document.getElementById('lightbox');
    if (box) {
        const pic = box.querySelector('img');
        const set = box.querySelector('.lightbox-set');
        let from = null, inSet = false;

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
        const BASE = 36;
        const DRIFT = [-1, .45, -.3, .95, -.75, .2, .7, -.5, 1, -.15, .55, -.9];
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        figs.forEach(f => { f.bw = BASE * Number(f.dataset.ratio || 1); });

        let W = 0, edge = 0, push = 0, step = 0;
        let focus = (N - 1) / 2, goal = focus, open = 0, openGoal = 0, raf = 0;

        const size = () => {
            W = pline.clientWidth;
            edge = 20 + BASE / 2;
            push = Math.min(220, W * .18);
            step = (W - 2 * edge - 2 * push) / (N - 1);
        };

        const draw = () => {
            /* how many neighbours open with the focused photo depends on how tightly the line is packed */
            const spread = Math.min(7, Math.max(1.6, 70 / Math.max(step, 1)));
            const H = pline.clientHeight;
            const tall = Math.min(360, H * .62, W * .42), drift = Math.min(70, H * .16, W * .1);
            figs.forEach((f, i) => {
                const d = i - focus;
                const near = Math.exp(-(d * d) / (spread * spread)) * open;
                const x = edge + push + i * step + Math.tanh(d / (spread * 1.1)) * push * open + (1 - open) * (i / (N - 1) - .5) * 2 * push;
                const y = DRIFT[i % DRIFT.length] * drift * near;
                const scale = 1 + near * (Math.min(tall / BASE, W * .5 / f.bw) - 1);
                if (scale !== f.sc) {
                    f.sc = scale;
                    f.style.width = f.bw * scale + 'px';
                    f.style.height = BASE * scale + 'px';
                    f.style.marginLeft = -f.bw * scale / 2 + 'px';
                    f.style.marginTop = -BASE * scale / 2 + 'px';
                }
                f.style.transform = 'translate(' + x + 'px,' + y + 'px)';
                f.style.zIndex = Math.round(near * 1000);
                f.classList.toggle('up', near > .35);
                if (near > .12) {
                    const img = f.querySelector('img[data-full]');
                    if (img) { img.src = img.dataset.full; delete img.dataset.full; }
                }
            });
        };

        const tick = () => {
            raf = 0;
            const k = still ? 1 : .18;
            focus += (goal - focus) * k;
            open += (openGoal - open) * k;
            if (Math.abs(goal - focus) < .002) focus = goal;
            if (Math.abs(openGoal - open) < .002) open = openGoal;
            draw();
            if (focus !== goal || open !== openGoal) raf = requestAnimationFrame(tick);
            else if (!open) pline.classList.remove('live');
        };
        const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

        const steer = e => {
            const x = e.clientX - pline.getBoundingClientRect().left;
            goal = Math.max(0, Math.min(N - 1, (x - edge - push) / step));
            openGoal = 1; pline.classList.add('live'); go();
        };
        pline.addEventListener('pointermove', steer);
        pline.addEventListener('pointerdown', steer);
        pline.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { openGoal = 0; go(); } });
        addEventListener('resize', () => { size(); draw(); });

        size();
        draw();
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
                tiles: ['--title', '--accent', '--ink'].map(c => {
                    const tile = document.createElement('canvas');
                    tile.width = w * 2;
                    tile.height = ROW * 2;
                    const t = tile.getContext('2d');
                    t.scale(2, 2);
                    t.font = font;
                    t.textBaseline = 'middle';
                    t.fillStyle = css.getPropertyValue(c).trim();
                    t.fillText(letter, 0, ROW / 2);
                    return tile;
                })
            };
        });

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
            ctx.globalCompositeOperation = 'source-in';
            ctx.drawImage(layer, 0, 0);
            ctx.globalCompositeOperation = 'source-over';

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
        fit();
    }
})();
