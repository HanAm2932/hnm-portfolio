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

    /* nothing waits for a hover or a click: once the page's own pictures are in, the ones behind them are fetched too:
       hover backgrounds, the certificate sets, and the full-size version of every small picture. Three at a time, in page order.
       The archive is left out: its 125 full-size pieces still arrive as each one nears the focus. */
    const warm = () => {
        if (navigator.connection && navigator.connection.saveData) return;
        const urls = new Set();
        const scan = from => {
            from.querySelectorAll('[data-bg]').forEach(el => urls.add(el.dataset.bg));
            from.querySelectorAll('template').forEach(t => {
                t.content.querySelectorAll('img[src]').forEach(img => urls.add(img.getAttribute('src')));
                scan(t.content);
            });
        };
        scan(document);
        document.querySelectorAll('img[data-full]').forEach(img => { if (!img.closest('#strip')) urls.add(img.dataset.full); });
        const queue = [...urls];
        const next = () => {
            if (!queue.length) return;
            const img = new Image();
            img.onload = img.onerror = next;
            img.src = queue.shift();
        };
        for (let i = 0; i < 3; i++) next();
    };
    if (document.readyState === 'complete') warm(); else addEventListener('load', warm);

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
        row.addEventListener('mouseenter', () => {
            bg.querySelector('span').textContent = row.dataset.bg ? '' : row.dataset.img;
            bg.style.backgroundImage = row.dataset.bg ? 'url("' + row.dataset.bg + '")' : '';
            bg.classList.toggle('photo', !!row.dataset.bg);
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
})();
