/* All behaviour of the page: language switch, frame and menu, quiz, terminal and its hidden commands, the Earth,
   live chat and slides. The texts come from i18n.js (I18N), which loads first */
(function () {
  var LANGS = ['en', 'de', 'ru', 'sr', 'el'];
  var current = 'de';
  var HTML_LANG = { sr: 'sr-Latn' };
  function t(key) {
    return (I18N[current] && I18N[current][key]) || I18N.en[key] || '';
  }
  function setLang(lang, save) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    current = lang;
    var dict = I18N[lang];
    document.documentElement.lang = HTML_LANG[lang] || lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v == null) return;
      var strike = el.hasAttribute('data-strike'), chat = el.hasAttribute('data-chatlink');
      if (!strike && !chat) { el.textContent = v; return; }
      el.textContent = '';
      v.split(/\[([^\]]+)\]/).forEach(function (part, k) {
        if (!part) return;
        if (k % 2) {
          var x = document.createElement(chat ? 'button' : 'span');
          if (chat) { x.type = 'button'; x.className = 'chat-link'; } else x.className = 'squiggle';
          x.textContent = part;
          el.appendChild(x);
        } else el.appendChild(document.createTextNode(part));
      });
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-ph')];
      if (v != null) el.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-aria')];
      if (v != null) el.setAttribute('aria-label', v);
    });
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', dict['meta.description']);
    document.querySelectorAll('.lang-menu button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
    var langNames = { de: 'Deutsch', en: 'English', ru: 'Русский', sr: 'Srpski', el: 'Ελληνικά' };
    var langCur = document.getElementById('lang-current');
    if (langCur) langCur.textContent = lang.toUpperCase();
    var langTog = document.getElementById('lang-toggle');
    if (langTog) langTog.setAttribute('aria-label', dict['lang.label'] + ': ' + langNames[lang]);
    refreshQuiz();
    refreshNext();
    refreshSmart();
    document.dispatchEvent(new CustomEvent('arfr:lang'));
    if (save) {
      try { localStorage.setItem('arfr-lang', lang); } catch (e) {}
      try { sessionStorage.removeItem('arfr-lang-link'); } catch (e) {}
    }
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the palette lives in the CSS (:root); canvas drawings and the sprite take their colours from there */
  var palette = getComputedStyle(document.documentElement);
  function tone(name) { return palette.getPropertyValue(name).trim(); }
  /* width of the black screen frame around the page (0 without it) */
  var sectionStep = null; /* set by the section paging below: sectionStep(1) one block down, -1 up */
  function frameInset() { var h = document.querySelector('.frame-hole'); return h ? Math.round(h.getBoundingClientRect().top) : 0; }

  /* Frame tabs: a trapezoid hanging from the frame edge, sized to its label */
  var tabShape = null, tabClosedWidth = null;
  (function frameTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.ftab'));
    if (!tabs.length) return;
    function corner(a, c, b, r) {
      var ux = a[0] - c[0], uy = a[1] - c[1], ul = Math.hypot(ux, uy);
      var vx = b[0] - c[0], vy = b[1] - c[1], vl = Math.hypot(vx, vy);
      var p = [c[0] + ux / ul * r, c[1] + uy / ul * r], q = [c[0] + vx / vl * r, c[1] + vy / vl * r];
      return 'L' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + 'Q' + c[0] + ' ' + c[1] + ' ' + q[0].toFixed(2) + ' ' + q[1].toFixed(2);
    }
    /* W wide, D deep; the slant of the sides stays that of the closed tab, the corners round off as it grows */
    function shape(t, W, D) {
      var svg = t.querySelector('svg'), path = svg && svg.querySelector('.ftab-fill'), edge = svg && svg.querySelector('.ftab-edge');
      if (!path) return;
      var td = t._td || D, a = 12, sl = Math.round(td * 0.55), o = 2;
      var rb = Math.min(20, 9 + Math.max(0, D - td) * 0.05);
      var P0 = [0, o], P1 = [a, o], P2 = [a + sl, o + D], P3 = [W - a - sl, o + D], P4 = [W - a, o], P5 = [W, o];
      var contour = 'M0 ' + o + corner(P0, P1, P2, a) + corner(P1, P2, P3, rb) + corner(P2, P3, P4, rb) + corner(P3, P4, P5, a) + 'L' + W + ' ' + o;
      path.setAttribute('d', contour + 'L' + W + ' 0L0 0Z');
      if (edge) edge.setAttribute('d', contour);
      svg.setAttribute('width', W); svg.setAttribute('height', D + o);
      svg.setAttribute('viewBox', '0 0 ' + W.toFixed(2) + ' ' + (D + o).toFixed(2));
      t.style.width = W + 'px';
      t.classList.add('drawn');
    }
    function closedWidth(t) {
      var label = t.querySelector('.ftab-swap') || t.querySelector('.ftab-label');
      var td = t._td, a = 12, sl = Math.round(td * 0.55), pad = 18;
      return Math.ceil(label.getBoundingClientRect().width) + 2 * (a + sl + pad);
    }
    function draw() {
      tabs.forEach(function (t) {
        if (!t.querySelector('.ftab-label')) return;
        if (t.classList.contains('is-open')) { t.dispatchEvent(new CustomEvent('ftab:redraw')); return; }
        t.style.height = '';
        t._td = t.getBoundingClientRect().height;
        shape(t, closedWidth(t), t._td);
      });
    }
    tabShape = shape;
    tabClosedWidth = closedWidth;
    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    window.addEventListener('resize', draw);
    document.addEventListener('arfr:lang', draw);
  })();

  /* Menu: the name tab slides down into a drawer that reaches about half the screen */
  (function tabMenu() {
    var tab = document.getElementById('menu-tab'), btn = document.getElementById('menu-toggle'), panel = document.getElementById('menu-panel');
    if (!tab || !btn || !panel || !tabShape) return;
    var isOpen = false, raf = 0, cur = null, timer = 0;
    function closedSize() { return { w: tabClosedWidth(tab), d: tab._td }; }
    function openSize() {
      var f = frameInset(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var w = Math.min(460, vw - 2 * f - 24);
      var need = tab._td + contentHeight(w) + 4 * 18;
      var d = Math.max(Math.round(vh / 2) - f, need);
      return { w: w, d: Math.min(d, vh - 2 * f - 24) };
    }
    /* the panel's own height when nothing stretches it: rows plus padding */
    function contentHeight(w) {
      var st = panel.style, b = st.bottom, j = st.justifyContent, tw = tab.style.width;
      tab.style.width = w + 'px'; /* measure at the open width, or the rows would wrap */
      st.bottom = 'auto'; st.justifyContent = 'flex-start';
      var h = panel.offsetHeight;
      st.bottom = b; st.justifyContent = j; tab.style.width = tw;
      return h;
    }
    function set(sz) { cur = sz; tab.style.height = sz.d + 'px'; tabShape(tab, sz.w, sz.d); }
    function glide(to, done) {
      cancelAnimationFrame(raf);
      var from = cur || closedSize();
      if (reduceMotion) { set(to); if (done) done(); return; }
      var t0 = performance.now(), dur = 460;
      (function frame(now) {
        var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        set({ w: from.w + (to.w - from.w) * e, d: from.d + (to.d - from.d) * e });
        if (k < 1) raf = requestAnimationFrame(frame); else if (done) done();
      })(t0);
    }
    function open(viaKey) {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(timer);
      if (!cur) cur = closedSize();
      tab.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      glide(openSize(), function () {
        if (!isOpen) return;
        tab.classList.add('shown');
        if (viaKey) { var first = panel.querySelector('a, button'); if (first) first.focus(); }
      });
    }
    function close(returnFocus) {
      if (!isOpen) return;
      isOpen = false;
      tab.classList.remove('shown');
      btn.setAttribute('aria-expanded', 'false');
      if (returnFocus) { quiet = true; btn.focus(); quiet = false; }
      clearTimeout(timer);
      timer = setTimeout(function () {
        glide(closedSize(), function () {
          if (isOpen) return;
          tab.classList.remove('is-open');
          panel.hidden = true;
          tab.style.height = '';
          cur = null;
        });
      }, reduceMotion ? 0 : 140);
    }
    var keyOpen = false, quiet = false, swallow = false;
    /* keyboard: the menu opens as soon as its button gets focus, so Tab walks through the entries;
       focus leaving the tab closes it again. A mouse still opens it with a click. */
    function enter() {
      var first = panel.querySelector('a, button');
      if (!first) return false;
      tab.classList.add('shown'); /* entries can take focus before the slide-down has finished */
      first.focus();
      return true;
    }
    btn.addEventListener('focus', function () {
      if (!quiet && !isOpen && btn.matches(':focus-visible')) open(false);
    });
    btn.addEventListener('keydown', function (e) {
      var go = e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown';
      if (isOpen && ((e.key === 'Tab' && !e.shiftKey) || go)) {
        if (enter()) { e.preventDefault(); swallow = go; }
        return;
      }
      if (go) keyOpen = true;
    });
    btn.addEventListener('click', function () {
      if (swallow) { swallow = false; return; }
      if (isOpen) close(false); else open(keyOpen);
      keyOpen = false;
    });
    tab.addEventListener('focusout', function (e) {
      if (isOpen && e.relatedTarget && !tab.contains(e.relatedTarget)) close(false);
    });
    /* nothing focused yet (fresh load, or a click on plain text): Tab starts at the menu, not after the click point */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      var a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      btn.focus();
      open(false);
    });
    panel.querySelectorAll('.menu-nav a, .menu-acts a').forEach(function (a) { a.addEventListener('click', function () { close(false); }); });
    var topLink = panel.querySelector('.menu-start');
    function goTop(e) {
      e.preventDefault();
      if (quizShow) quizShow.close(true);
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      /* back at the start, the address loses its section mark (#terminal and the like); a new history step,
         as a link would make, so Back still returns to the section */
      var id = decodeURIComponent(location.hash.slice(1));
      if (id && document.getElementById(id) && history.pushState) history.pushState(null, '', location.pathname + location.search);
    }
    if (topLink) topLink.addEventListener('click', function (e) { close(false); goTop(e); });
    /* the ladder's first step is Start too: from inside the quiz it goes back to the headline, like the menu */
    var ladderTop = document.querySelector('.side-steps a[href="#top"]');
    if (ladderTop) ladderTop.addEventListener('click', goTop);
    panel.querySelectorAll('.lang-menu button').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
    });
    var chatBtn = panel.querySelector('.menu-chat');
    if (chatBtn) chatBtn.addEventListener('click', function () { close(false); startChat(); });
    document.addEventListener('click', function (e) { if (isOpen && !tab.contains(e.target)) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(true); });
    /* a resize or another language while open: settle at the new size without a glide */
    tab.addEventListener('ftab:redraw', function () {
      if (!isOpen) return;
      tab.style.height = '';
      tab._td = btn.getBoundingClientRect().height;
      set(openSize());
    });
  })();

  /* Bottom tab: a click goes one section down; at the very end the copyright takes its place */
  (function footTab() {
    var tab = document.querySelector('.ftab-bottom');
    var hint = tab && tab.querySelector('.ftab-scroll'), copy = tab && tab.querySelector('.ftab-copy');
    if (!hint || !copy) return;
    var atEnd = null;
    function check() {
      var root = document.documentElement;
      var end = window.scrollY + window.innerHeight >= root.scrollHeight - 24;
      if (end === atEnd) return;
      atEnd = end;
      tab.classList.toggle('at-end', end);
      hint.tabIndex = end ? -1 : 0;
      hint.setAttribute('aria-hidden', end ? 'true' : 'false');
      copy.tabIndex = end ? 0 : -1;
      copy.setAttribute('aria-hidden', end ? 'false' : 'true');
    }
    hint.addEventListener('click', function () { if (sectionStep) sectionStep(1); });
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
  })();

  /* Quiz: the visitor picks an answer, the "AI" applauds whatever it was, then Alex gives the verdict */
  var quizRoot = document.querySelector('.carousel');
  var quizFig = quizRoot ? quizRoot.closest('figure') : null;
  var quizSlides = quizRoot ? Array.prototype.slice.call(quizRoot.querySelectorAll('.slide')) : [];
  var quizState = quizSlides.map(function () { return null; });
  var quizGo = null; /* set by the stage below: quizGo(k) shows question k */
  var quizJoined = false; /* the visitor has answered at least once: from then on the quiz is a stop on the way */
  function typeInto(el, text, done) {
    if (reduceMotion) {
      el.classList.remove('thinking');
      el.textContent = text;
      done();
      return;
    }
    /* the live region announces the whole reply once; the typing copy is hidden from screen readers */
    var shown = document.createElement('span');
    var said = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    said.className = 'sr-only';
    el.textContent = '';
    el.appendChild(shown);
    el.appendChild(said);
    el.classList.add('thinking');
    shown.textContent = '…';
    var k = 0, timer = 0, over = false, area = quizFig || document;
    function finish() {
      if (over) return;
      over = true;
      clearTimeout(timer);
      area.removeEventListener('click', finish, true);
      el.classList.remove('thinking');
      if (!said.textContent) said.textContent = text;
      shown.textContent = text;
      done();
    }
    /* registered after the answering click has passed, so only a later click skips ahead */
    setTimeout(function () { if (!over) area.addEventListener('click', finish, true); }, 0);
    timer = setTimeout(function () {
      el.classList.remove('thinking');
      said.textContent = text;
      (function step() {
        k += 1;
        shown.textContent = text.slice(0, k);
        if (k < text.length) timer = setTimeout(step, 12); else finish();
      })();
    }, 300);
  }
  function showVerdict(st, el) {
    el.textContent = t(st.right ? 'v.right' : 'v.wrong');
    el.className = 'verdict ' + (st.right ? 'is-right' : 'is-wrong');
  }
  /* the card in the hero mirrors the first question: once it is answered there, the card shows the answer
     and the way back into the quiz */
  var teaser = document.querySelector('.quiz-teaser');
  function syncTeaser() {
    if (!teaser || !quizSlides.length) return;
    /* the open quiz hangs from the bottom of the hero, and on phones the card sits right above it: when the card
       grows or shrinks, the page follows, so the quiz stays where it is on the screen */
    var held = quizShow && quizShow.isOpen() ? quizShowRoot.getBoundingClientRect().top : null;
    var st = quizState[0], on = !!(st && st.revealed);
    var src = quizSlides[0].querySelectorAll('.opt');
    var a = document.activeElement, had = teaser.contains(a);
    teaser.classList.toggle('is-joined', on);
    teaser.querySelectorAll('.opt').forEach(function (b, n) {
      b.classList.toggle('is-picked', on && !!src[n] && src[n].classList.contains('is-picked'));
      b.classList.toggle('is-correct', on && !!src[n] && src[n].classList.contains('is-correct'));
      b.disabled = on;
    });
    var row = teaser.querySelector('.teaser-resume');
    var graded = quizState.filter(function (s, k) { return !quizSlides[k].hasAttribute('data-cta'); });
    var done = graded.filter(function (s) { return s && s.revealed; }).length;
    row.hidden = !on;
    row.querySelector('.teaser-go').classList.toggle('is-done', done === graded.length);
    if (held !== null) {
      var moved = quizShowRoot.getBoundingClientRect().top - held;
      if (Math.abs(moved) > 0.5) window.scrollBy({ top: moved, behavior: 'instant' });
    }
    if (had && a && a.disabled) (on ? row.querySelector('.teaser-go') : teaser.querySelector('.opt')).focus({ preventScroll: true });
  }
  function updateScore() {
    syncTeaser();
    if (!quizFig) return;
    var box = quizFig.querySelector('.quiz-score');
    var graded = quizState.filter(function (s, k) { return !quizSlides[k].hasAttribute('data-cta'); });
    var done = graded.filter(function (s) { return s && s.revealed; });
    var complete = done.length === graded.length;
    quizDone = complete;
    markDone();
    if (!complete) { hideResult(); return; }
    var right = done.filter(function (s) { return s.right; }).length;
    /* the visitor's score in cyan, the AI's praise in amber: it liked every answer */
    function key(k) { return t(k).replace(/[:：]\s*$/, ''); }
    var you = box.querySelector('.score-you'), ai = box.querySelector('.score-ai');
    you.querySelector('.score-n').textContent = right + '/' + graded.length;
    you.querySelector('.score-k').textContent = key('score.k1');
    ai.querySelector('.score-n').textContent = graded.length + '/' + graded.length;
    ai.querySelector('.score-k').textContent = key('score.k2');
    var full = t('score.text').replace('{n}', right).replace('{total}', graded.length);
    var cut = full.indexOf('. ');
    box.querySelector('.quiz-score-text').textContent = cut > 0 ? full.slice(cut + 2) : full;
  }
  var quizDone = false, quizLabel = null;
  function quizComplete() { return quizDone; }
  function resultOpen() { var b = quizFig && quizFig.querySelector('.quiz-score'); return !!(b && !b.hidden); }
  /* the result covers the questions; they are out of reach for the keyboard while it is open */
  function showResult() {
    var b = quizFig && quizFig.querySelector('.quiz-score');
    if (!b || !quizDone) return;
    var inside = quizFig.contains(document.activeElement);
    b.hidden = false;
    quizRoot.querySelector('.track').inert = true;
    if (quizLabel) quizLabel();
    if (inside) b.querySelector('.quiz-bonus').focus({ preventScroll: true });
  }
  function hideResult() {
    var b = quizFig && quizFig.querySelector('.quiz-score');
    if (b) b.hidden = true;
    if (quizRoot) quizRoot.querySelector('.track').inert = false;
    if (quizLabel) quizLabel();
  }
  function refreshQuiz() {
    quizSlides.forEach(function (s, k) {
      var st = quizState[k];
      if (!st || !st.revealed) return;
      s.querySelector('.ai-text').textContent = t(st.reply);
      showVerdict(st, s.querySelector('.verdict'));
    });
    updateScore();
  }
  /* tags, verdict and the way on hold both of their words in the markup, so the reveal never changes the card's size */
  function clearVerdict(s) {
    var v = s.querySelector('.verdict');
    v.textContent = '';
    v.className = 'verdict';
  }
  function markDone() { quizRoot.classList.toggle('quiz-done', quizDone); }
  function answer(k, btn) {
    if (quizState[k]) return;
    quizJoined = true;
    var s = quizSlides[k];
    var optKey = (btn.querySelector('[data-i18n^="o."]') || { getAttribute: function () { return ''; } }).getAttribute('data-i18n');
    var replyKey = 'ai.' + optKey.slice(2);
    if (!optKey || !t(replyKey)) replyKey = 'ai.r' + (1 + Math.floor(Math.random() * 5));
    var st = { right: btn.getAttribute('data-correct') === '1', reply: replyKey, revealed: false };
    quizState[k] = st;
    s.querySelectorAll('.opt').forEach(function (b) { b.disabled = true; });
    btn.classList.add('is-picked');
    btn.setAttribute('aria-pressed', 'true');
    s.classList.add('answering');
    typeInto(s.querySelector('.ai-text'), t(st.reply), function () {
      setTimeout(function () {
        if (quizState[k] !== st) return;
        s.querySelectorAll('.opt').forEach(function (b) {
          if (b.getAttribute('data-correct') === '1') b.classList.add('is-correct');
        });
        showVerdict(st, s.querySelector('.verdict'));
        st.revealed = true;
        s.classList.add('answered');
        var dot = quizFig.querySelectorAll('.dot')[k];
        if (dot) dot.classList.add(st.right ? 'is-right' : 'is-wrong');
        if (quizLabel) quizLabel();
        updateScore();
        /* the clicked answer is disabled now: the way on takes the focus, so the keyboard does not start over */
        var a = document.activeElement;
        if (!a || a === document.body || a === quizShowRoot || s.contains(a)) s.querySelector('.stage-next').focus({ preventScroll: true });
      }, reduceMotion ? 0 : 450);
    });
  }
  /* the last slide is a call to action: its answer and its button open the live chat (or a mail when there is no chat) */
  function startChat() {
    var open = document.getElementById('chat-open');
    if (open && !open.hidden) open.click();
    else location.href = 'mailto:hello@arfr.de?subject=' + encodeURIComponent(t('next.subject') + ' (Chat)');
  }
  if (quizFig) {
    quizFig.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.chat-link')) startChat(); });
    quizRoot.classList.add('quiz-on');
    markDone();
    quizSlides.forEach(function (s, k) {
      s.querySelectorAll('.opt').forEach(function (b) {
        b.addEventListener('click', function () { answer(k, b); });
      });
    });
    /* the result closes under the focus: the keyboard goes on with the first answer of what comes next */
    function focusFirst() {
      var o = quizRoot.querySelector('.slide.is-current .opt:not(:disabled)');
      if (o) o.focus({ preventScroll: true });
    }
    quizFig.querySelector('.quiz-bonus').addEventListener('click', function () {
      var inside = quizFig.contains(document.activeElement);
      hideResult();
      document.dispatchEvent(new CustomEvent('arfr:bonus', { detail: { unlock: true } }));
      if (inside) focusFirst();
    });
    quizFig.querySelector('.quiz-again').addEventListener('click', function () {
      var inside = quizFig.contains(document.activeElement);
      hideResult();
      document.dispatchEvent(new CustomEvent('arfr:bonus', { detail: { unlock: false } }));
      quizState = quizSlides.map(function () { return null; });
      quizSlides.forEach(function (s) {
        s.classList.remove('answering', 'answered');
        s.querySelector('.ai-text').textContent = '';
        clearVerdict(s);
        s.querySelectorAll('.opt').forEach(function (b) {
          b.disabled = false;
          b.classList.remove('is-correct', 'is-picked');
          b.removeAttribute('aria-pressed');
        });
      });
      quizFig.querySelectorAll('.dot').forEach(function (d) { d.classList.remove('is-right', 'is-wrong'); });
      updateScore();
      if (quizGo) quizGo(0);
      if (inside) focusFirst();
    });
  }

  /* Quiz slide: the hero shows the first question only; an answer there moves the quiz in from the right,
     with that answer already given. From then on the quiz is the second slide: every way forward from the
     headline leads to it, every way back from it to the headline, and from below the way up leads through it.
     Escape goes back at once; A, B and C answer while the quiz is in view. */
  var quizShowRoot = document.getElementById('quiz-show');
  var quizShow = (function () {
    var root = quizShowRoot;
    var hero = root && root.closest('.hero');
    var heroWrap = hero && hero.querySelector(':scope > .wrap');
    if (!root || !quizFig || !heroWrap) return null;
    var open = false;
    function setOpen(on, instant) {
      open = on;
      if (instant) { hero.classList.add('quiz-instant'); void hero.offsetWidth; }
      hero.classList.toggle('quiz-shown', on);
      root.inert = !on;
      root.setAttribute('aria-hidden', on ? 'false' : 'true');
      heroWrap.inert = on;
      if (instant) { void hero.offsetWidth; hero.classList.remove('quiz-instant'); }
    }
    /* the hero fills the view (or, on phones, the quiz's own screen does) */
    function inView() {
      var r = (open ? root : hero).getBoundingClientRect();
      return r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
    }
    /* the headline, or the quiz, sits right at the top of the frame: the page is "on" that slide */
    function onHeadline() { return !open && Math.abs(hero.getBoundingClientRect().top - frameInset()) < 40; }
    function onQuiz() { return open && Math.abs(root.getBoundingClientRect().top - frameInset()) < 40; }
    function onKey(e) {
      if (!open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !inView()) return;
      var a = document.activeElement;
      if (a && a !== document.body && !root.contains(a)) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key.length !== 1) return;
      var n = 'abc'.indexOf(e.key.toLowerCase());
      if (n < 0) return;
      var scope = resultOpen() ? quizFig.querySelector('.quiz-score') : quizRoot.querySelector('.slide.is-current');
      var b = scope && scope.querySelectorAll('.opt')[n];
      if (b && !b.disabled) { e.preventDefault(); b.focus({ preventScroll: true }); b.click(); }
    }
    document.addEventListener('keydown', onKey);
    function show(pick) {
      movedAt = Date.now();
      setOpen(true);
      /* on phones the hero is taller than the screen: the quiz takes its lower screen, right where the answer was */
      var r = root.getBoundingClientRect();
      if (r.top < -2 || r.bottom > window.innerHeight + 2) root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
      root.focus({ preventScroll: true });
      if (typeof pick === 'number' && !quizState[0]) {
        hideResult();
        if (quizGo) quizGo(0);
        var b = quizSlides[0].querySelectorAll('.opt')[pick];
        if (b) answer(0, b);
        return;
      }
      /* back again: on where the visitor left off */
      var f = resultOpen() ? quizFig.querySelector('.quiz-bonus') : quizRoot.querySelector('.slide.is-current .opt:not(:disabled), .slide.is-current.answered .stage-next');
      if (f) f.focus({ preventScroll: true });
    }
    function close(keepFocus, instant) {
      if (!open) return;
      var inside = root.contains(document.activeElement);
      movedAt = Date.now();
      setOpen(false, instant);
      if (!keepFocus && inside) { var t0 = heroWrap.querySelector('.quiz-teaser .opt:not(:disabled), .quiz-teaser .teaser-go'); if (t0) t0.focus({ preventScroll: true }); }
    }
    /* One order for every way of moving: headline, quiz, then the sections below. Forward (wheel down, arrow
       right or down, Page Down, space, the "scroll down" tab) goes from the headline to the quiz; back (wheel up,
       arrow left or up, Page Up) goes from the quiz to the headline. Everywhere else the page moves as before.
       Only for visitors who have answered: until then the quiz stays out of the way and the page goes straight
       from the headline to the sections below. */
    var movedAt = 0;
    function page(dir) {
      if (dir > 0 && quizJoined && onHeadline()) { show(); return true; }
      if (dir < 0 && onQuiz()) { close(); return true; }
      return false;
    }
    /* the wheel: a notch (or a trackpad swipe) that changes between headline and quiz turns the page sideways.
       The rest of that gesture is swallowed until the wheel rests, so its run-out does not carry on down the page */
    var lockUntil = 0;
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var game = document.getElementById('game');
      if (game && !game.hidden) return;
      var now = Date.now();
      if (now < lockUntil) { e.preventDefault(); lockUntil = Math.max(now + 250, movedAt + 600); return; }
      if (!page(e.deltaY > 0 ? 1 : -1)) return;
      e.preventDefault();
      lockUntil = now + 600;
    }, { passive: false });
    /* keys that move up and down; left and right go through the section paging below, which asks page() first */
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var a = document.activeElement, idle = !a || a === document.body || a === document.documentElement || a === root;
      var dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key] || (e.key === ' ' && idle ? (e.shiftKey ? -1 : 1) : 0);
      if (!dir || e.shiftKey && e.key !== ' ') return;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      var chat = document.getElementById('chat-dialog');
      if (chat && chat.contains(a)) return;
      if (page(dir)) e.preventDefault();
    });
    /* phones (the quiz is the lower screen of the hero): scrolled up a little past the quiz, the headline is
       back. Going on down the page keeps the quiz, so the way back up leads through it again */
    var tick = 0;
    window.addEventListener('scroll', function () {
      if (!open || tick) return;
      tick = requestAnimationFrame(function () {
        tick = 0;
        var top = root.getBoundingClientRect().top;
        if (open && Date.now() - movedAt > 1200 && top > window.innerHeight * 0.15 && top < window.innerHeight) close(true);
      });
    }, { passive: true });
    document.querySelectorAll('.quiz-teaser .opt').forEach(function (b) {
      b.addEventListener('click', function () { show(+b.getAttribute('data-pick')); });
    });
    root.querySelectorAll('.stage-back').forEach(function (b) { b.addEventListener('click', function () { close(); }); });
    var go = heroWrap.querySelector('.teaser-go');
    if (go) go.addEventListener('click', function () { if (quizComplete()) showResult(); show(); });
    return { open: show, close: close, page: page, isOpen: function () { return open; } };
  })();
  /* every mail link carries the subject, so mails from the site are easy to spot */
  function refreshNext() {
    var href = 'mailto:hello@arfr.de?subject=' + encodeURIComponent(t('next.subject'));
    document.querySelectorAll('a[href^="mailto:hello@arfr.de"]:not(.chat-mail)').forEach(function (a) { a.setAttribute('href', href); });
  }
  /* Werkstatt: each experiment has a way straight in. The quiz opens once the page is back at the headline */
  (function workshop() {
    var quizBtn = document.getElementById('ws-quiz'), cliBtn = document.getElementById('ws-cli'), slideBtn = document.getElementById('ws-slides');
    if (quizBtn) quizBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var t0 = Date.now();
      (function wait() {
        if (window.scrollY < 2 || Date.now() - t0 > 1500) { if (quizShow) quizShow.open(); }
        else requestAnimationFrame(wait);
      })();
    });
    if (cliBtn) cliBtn.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('arfr:type', { detail: { cmd: 'help' } }));
    });
    if (slideBtn) slideBtn.addEventListener('click', function () { if (sectionStep) sectionStep(1); });
  })();
  /* "Kaffee": off to the terminal, which types `coffee` by itself */
  (function coffeeButton() {
    var go = document.getElementById('coffee-go');
    if (go) go.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('arfr:type', { detail: { cmd: 'coffee' } }));
    });
  })();

  /* Secret game LIGHTRACE: a light-trail duel, human vs AI. Unlocked with `play` in the terminal. */
  var game = (function lightrace() {
    var root = document.getElementById('game');
    var cv = document.getElementById('game-canvas');
    if (!root || !cv || !cv.getContext) return null;
    var ctx = cv.getContext('2d');
    var stage = document.getElementById('game-stage');
    var msg = document.getElementById('game-msg');
    var elYou = document.getElementById('score-you');
    var elAi = document.getElementById('score-ai');
    var CYAN = tone('--human-rgb'), AMBER = tone('--ai-rgb');
    var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    var COLS = 64, ROWS = 40, cell = 12;
    var board, you, bot, state = 'idle', loop = 0, countTimer = 0;
    var score = { you: 0, ai: 0 }, onClose = null, lastFocus = null;
    var STEP_MS = 75;

    function showMsg(text) { msg.textContent = text; }
    function fit() {
      var r = stage.getBoundingClientRect();
      cell = Math.max(5, Math.floor(Math.min(r.width / COLS, r.height / ROWS)));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = (COLS * cell) + 'px';
      cv.style.height = (ROWS * cell) + 'px';
      cv.width = COLS * cell * dpr;
      cv.height = ROWS * cell * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function idx(x, y) { return y * COLS + x; }
    function free(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && board[idx(x, y)] === 0; }
    function mark(p) { board[idx(p.x, p.y)] = p.id; p.trail.push([p.x, p.y]); }
    function opposite(a, b) { return DIRS[a][0] === -DIRS[b][0] && DIRS[a][1] === -DIRS[b][1]; }

    function reset() {
      var r = stage.getBoundingClientRect();
      var portrait = r.height > r.width;
      COLS = portrait ? 30 : 64;
      ROWS = portrait ? 44 : 40;
      fit();
      board = new Uint8Array(COLS * ROWS);
      if (portrait) {
        var cx = Math.floor(COLS / 2);
        you = { id: 1, x: cx, y: ROWS - 6, dir: 'up', next: null, trail: [] };
        bot = { id: 2, x: cx, y: 5, dir: 'down', trail: [] };
      } else {
        var cy = Math.floor(ROWS / 2);
        you = { id: 1, x: 6, y: cy, dir: 'right', next: null, trail: [] };
        bot = { id: 2, x: COLS - 7, y: cy, dir: 'left', trail: [] };
      }
      mark(you);
      mark(bot);
      draw();
    }

    /* The AI looks for open space, likes to go straight and drifts toward you */
    function room(x, y, limit) {
      if (!free(x, y)) return -1;
      var seen = new Uint8Array(COLS * ROWS);
      var q = [x, y], head = 0, n = 0;
      seen[idx(x, y)] = 1;
      while (head < q.length && n < limit) {
        var px = q[head++], py = q[head++];
        n++;
        for (var d in DIRS) {
          var nx = px + DIRS[d][0], ny = py + DIRS[d][1];
          if (free(nx, ny) && !seen[idx(nx, ny)]) { seen[idx(nx, ny)] = 1; q.push(nx, ny); }
        }
      }
      return n;
    }
    function think() {
      var best = bot.dir, bestScore = -Infinity;
      for (var d in DIRS) {
        if (opposite(d, bot.dir)) continue;
        var nx = bot.x + DIRS[d][0], ny = bot.y + DIRS[d][1];
        var s = room(nx, ny, 150);
        if (s < 0) continue;
        if (d === bot.dir) s += 6;
        s += Math.random() * 8;
        s -= (Math.abs(nx - you.x) + Math.abs(ny - you.y)) * 0.15;
        if (s > bestScore) { bestScore = s; best = d; }
      }
      bot.dir = best;
    }

    function step() {
      if (you.next && !opposite(you.next, you.dir)) you.dir = you.next;
      you.next = null;
      think();
      var yx = you.x + DIRS[you.dir][0], yy = you.y + DIRS[you.dir][1];
      var bx = bot.x + DIRS[bot.dir][0], by = bot.y + DIRS[bot.dir][1];
      var youOut = !free(yx, yy), botOut = !free(bx, by);
      if (yx === bx && yy === by) { youOut = true; botOut = true; }
      if (!youOut) { you.x = yx; you.y = yy; mark(you); }
      if (!botOut) { bot.x = bx; bot.y = by; mark(bot); }
      draw(youOut ? you : null, botOut ? bot : null);
      if (youOut || botOut) finish(youOut, botOut);
    }
    function finish(youOut, botOut) {
      clearInterval(loop);
      state = 'over';
      var key;
      if (youOut && botOut) key = 'game.draw';
      else if (botOut) { score.you += 1; key = 'game.win'; }
      else { score.ai += 1; key = 'game.lose'; }
      elYou.textContent = score.you;
      elAi.textContent = score.ai;
      showMsg(t(key) + '\n\n' + t('game.again'));
    }

    function drawTrail(p, rgb) {
      if (!p.trail.length) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(' + rgb + ',0.95)';
      ctx.lineWidth = Math.max(2, cell * 0.45);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(' + rgb + ',1)';
      ctx.shadowBlur = cell * 1.2;
      ctx.beginPath();
      p.trail.forEach(function (c, i) {
        var x = (c[0] + 0.5) * cell, y = (c[1] + 0.5) * cell;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = cell * 1.6;
      ctx.fillStyle = tone('--white');
      var hx = (p.x + 0.5) * cell, hy = (p.y + 0.5) * cell;
      ctx.fillRect(hx - cell * 0.35, hy - cell * 0.35, cell * 0.7, cell * 0.7);
      ctx.restore();
    }
    function burst(p, rgb) {
      var x = (p.x + 0.5 + DIRS[p.dir][0] * 0.5) * cell, y = (p.y + 0.5 + DIRS[p.dir][1] * 0.5) * cell;
      var g = ctx.createRadialGradient(x, y, 0, x, y, cell * 5);
      g.addColorStop(0, 'rgba(' + tone('--white-rgb') + ',0.95)');
      g.addColorStop(0.3, 'rgba(' + rgb + ',0.7)');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - cell * 5, y - cell * 5, cell * 10, cell * 10);
    }
    function draw(youCrash, botCrash) {
      var W = COLS * cell, H = ROWS * cell;
      ctx.fillStyle = tone('--stage-bg');
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(' + CYAN + ',0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= COLS; x += 2) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); }
      for (var y = 0; y <= ROWS; y += 2) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); }
      ctx.stroke();
      drawTrail(you, CYAN);
      drawTrail(bot, AMBER);
      if (youCrash) burst(youCrash, CYAN);
      if (botCrash) burst(botCrash, AMBER);
    }

    function countdown() {
      reset();
      state = 'count';
      var n = 3;
      showMsg(String(n));
      (function tick() {
        countTimer = setTimeout(function () {
          n -= 1;
          if (n > 0) { showMsg(String(n)); tick(); return; }
          showMsg('');
          state = 'run';
          loop = setInterval(step, STEP_MS);
        }, 700);
      })();
    }
    function pause() {
      if (state !== 'run') return;
      clearInterval(loop);
      state = 'paused';
      showMsg(t('game.paused'));
    }
    function resume() {
      if (state !== 'paused') return;
      showMsg('');
      state = 'run';
      loop = setInterval(step, STEP_MS);
    }
    function primary() {
      if (state === 'ready' || state === 'over') countdown();
      else if (state === 'paused') resume();
    }
    function steer(d) {
      if (state === 'run' || state === 'count') {
        if (!opposite(d, you.dir)) you.next = d;
      } else {
        primary();
      }
    }

    var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (KEYS[e.key]) { e.preventDefault(); steer(KEYS[e.key]); return; }
      if (e.key === ' ' || e.key === 'Enter') {
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
        e.preventDefault();
        primary();
      }
    }
    function onResize() {
      if (state === 'idle') return;
      fit();
      draw();
    }
    function onVisibility() { if (document.hidden) pause(); }

    var sx = 0, sy = 0, swiping = false;
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; swiping = true; });
    stage.addEventListener('pointerup', function (e) {
      if (!swiping) return;
      swiping = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { primary(); return; }
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
      else steer(dy > 0 ? 'down' : 'up');
    });
    stage.addEventListener('pointercancel', function () { swiping = false; });
    root.querySelectorAll('.game-pad button').forEach(function (b) {
      b.addEventListener('click', function () { steer(b.getAttribute('data-dir')); });
    });
    document.getElementById('game-close').addEventListener('click', function () { close(); });

    function open(cb) {
      onClose = cb || null;
      lastFocus = document.activeElement;
      score = { you: 0, ai: 0 };
      elYou.textContent = '0';
      elAi.textContent = '0';
      root.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      reset();
      state = 'ready';
      showMsg('LIGHTRACE\n\n' + t('game.start'));
      root.focus({ preventScroll: true });
    }
    function close() {
      clearInterval(loop);
      clearTimeout(countTimer);
      state = 'idle';
      root.hidden = true;
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      if (onClose) onClose(score.you, score.ai);
    }
    return { open: open };
  })();

  /* Hidden command `smart`: compress the page to its minimum (and back) */
  var smartStats = null;
  function fmtNum(n) { try { return n.toLocaleString(current === 'en' ? 'en-US' : (HTML_LANG[current] || current)); } catch (e) { return String(n); } }
  function refreshSmart() {
    var el = document.getElementById('smart-stats');
    if (!el || !smartStats) return;
    el.textContent = t('smart.stats').replace('{full}', fmtNum(smartStats.full)).replace('{min}', fmtNum(smartStats.min)).replace('{pct}', smartStats.pct);
  }
  var smartMode = (function () {
    var view = document.getElementById('smart-view');
    var on = false;
    function words(text) { text = (text || '').trim(); return text ? text.split(/\s+/).length : 0; }
    function measure() {
      var main = document.querySelector('main'), core = document.getElementById('smart-core');
      var full = words(main ? main.innerText : ''), min = words(core ? core.textContent : '');
      smartStats = { full: full, min: min, pct: full ? Math.round((1 - min / full) * 100) : 0 };
      return smartStats;
    }
    function swap(fn, after) {
      if (document.startViewTransition && !reduceMotion) {
        var tr = document.startViewTransition(fn);
        if (after) tr.finished.then(after, after);
      } else { fn(); if (after) after(); }
    }
    function enter() {
      if (on || !view) return;
      on = true;
      refreshSmart();
      swap(function () {
        document.documentElement.classList.add('smart');
        view.hidden = false;
        window.scrollTo(0, 0);
      });
    }
    function exit(after) {
      if (!on) return;
      on = false;
      swap(function () {
        document.documentElement.classList.remove('smart');
        view.hidden = true;
      }, after);
    }
    return { enter: enter, exit: exit, measure: measure, isOn: function () { return on; } };
  })();

  /* Hidden command `bug`: an original pixel bug that crawls through the page eating letters; `fix` restores them */
  var bug = (function () {
    var BODY = [
      '..........a.',
      '.........a..',
      '...bbbbb.hh.',
      '..bbsbbbbhhh',
      '.bbbbbsbbhhe',
      '..bsbbbbbhhh',
      '...bbbbb.hh.'
    ];
    var LEGS = [['..l..l..l...', '.l..l..l....'], ['.l..l..l....', '..l..l..l...']];
    var COLORS = { a: tone('--ai'), b: tone('--ai'), s: tone('--ai-light'), h: tone('--ai-dark'), e: tone('--white'), l: tone('--ai-dark') };
    var active = false, sprite = null, timer = 0, queue = [], qi = 0, cur = null, ci = 0, wrapped = [], eaten = 0, lastX = null, lastY = null, onDone = null;
    function svgFrame(rows, cls) {
      var r = '';
      rows.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) {
          var c = row.charAt(x);
          if (c !== '.') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + COLORS[c] + '"/>';
        }
      });
      return '<svg class="' + cls + '" viewBox="0 0 12 9" aria-hidden="true">' + r + '</svg>';
    }
    function makeSprite() {
      var el = document.createElement('div');
      el.className = 'bug-sprite walk';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = svgFrame(BODY.concat(LEGS[0]), 'f1') + svgFrame(BODY.concat(LEGS[1]), 'f2');
      document.body.appendChild(el);
      return el;
    }
    function collect() {
      var nodes = [];
      var skip = 'script, style, svg, canvas, .cli, #game, .site-head, .lang-menu, .sr-only, [hidden], .slide[aria-hidden="true"], .bug-sprite, .chatw';
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          var p = n.parentElement;
          if (!p || p.closest(skip) || !p.getClientRects().length) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
      /* start with the text the visitor is looking at, then go round the whole page */
      var head = document.querySelector('.site-head');
      var topLimit = head ? head.getBoundingClientRect().bottom : 0, start = 0, range = document.createRange();
      for (var i = 0; i < nodes.length; i++) {
        range.selectNodeContents(nodes[i]);
        var r = range.getBoundingClientRect();
        if (r.bottom > topLimit && r.top < window.innerHeight) { start = i; break; }
      }
      return nodes.slice(start).concat(nodes.slice(0, start));
    }
    function wrap(node) {
      var text = node.nodeValue, w = document.createElement('span'), spans = [];
      w.className = 'bug-w';
      for (var k = 0; k < text.length; k++) {
        var sp = document.createElement('span');
        sp.textContent = text.charAt(k);
        w.appendChild(sp);
        spans.push(sp);
      }
      node.parentNode.replaceChild(w, node);
      wrapped.push({ w: w, text: text });
      return spans;
    }
    function nextChar() {
      for (;;) {
        while (cur && ci < cur.length) {
          var sp = cur[ci++];
          if (sp.isConnected && /\S/.test(sp.textContent)) return sp;
        }
        if (qi >= queue.length) return null;
        var node = queue[qi++];
        if (!node.isConnected || !node.parentNode) { cur = null; continue; }
        cur = wrap(node);
        ci = 0;
      }
    }
    function moveTo(r) {
      var size = Math.max(16, Math.min(44, r.height * 1.3)), hgt = size * 0.75;
      var x = r.left + window.scrollX - size * 0.55, y = r.top + window.scrollY + r.height / 2 - hgt / 2;
      sprite.style.width = size + 'px';
      sprite.style.height = hgt + 'px';
      var jump = lastX === null || Math.abs(x - lastX) > 90 || Math.abs(y - lastY) > 40;
      if (jump) { sprite.style.transition = 'none'; void sprite.offsetWidth; }
      sprite.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (jump) { void sprite.offsetWidth; sprite.style.transition = ''; }
      lastX = x; lastY = y;
    }
    function step() {
      if (!active) return;
      var sp = nextChar();
      if (!sp) {
        sprite.classList.remove('walk');
        var cb = onDone; onDone = null;
        if (cb) cb();
        return;
      }
      var r = sp.getBoundingClientRect();
      if (r.width || r.height) {
        moveTo(r);
        setTimeout(function () { sp.classList.add('eaten'); }, 50);
        eaten += 1;
        timer = setTimeout(step, Math.max(22, 75 - eaten * 0.25));
      } else {
        sp.classList.add('eaten');
        timer = setTimeout(step, 0);
      }
    }
    function start(done) {
      active = true; eaten = 0; lastX = lastY = null; onDone = done || null;
      queue = collect(); qi = 0; cur = null; ci = 0; wrapped = [];
      sprite = makeSprite();
      step();
    }
    function restore() {
      clearTimeout(timer);
      wrapped.forEach(function (o) {
        if (o.w.isConnected && o.w.parentNode) o.w.parentNode.replaceChild(document.createTextNode(o.text), o.w);
      });
      wrapped = []; queue = []; cur = null;
      if (sprite && sprite.parentNode) sprite.parentNode.removeChild(sprite);
      sprite = null; active = false; onDone = null;
    }
    return { start: start, restore: restore, active: function () { return active; } };
  })();

  /* Snowfall over the whole page (hidden terminal command `snow`); snow piles up on elements over time */
  var snow = (function () {
    var cv = null, ctx = null, flakes = [], raf = 0, stopping = false, w = 0, h = 0, safety = 0, refreshTimer = 0;
    var surfaces = [], topClip = 0, BUCKET = 3, CAP = 12;
    var SURFACES = '#approach, #about, #contact, .site-foot, .review-card, .hero .btn, .bar, ' +
      '.steps li, .term, .contact-row .btn, .mail-copy, .cli';
    function resize() {
      if (!cv) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      refresh();
    }
    function resample(src, n) {
      var out = new Float32Array(n);
      if (!src.length) return out;
      for (var i = 0; i < n; i++) {
        var pos = n > 1 ? i * (src.length - 1) / (n - 1) : 0, a = Math.floor(pos), b = Math.min(src.length - 1, a + 1), t = pos - a;
        out[i] = src[a] * (1 - t) + src[b] * t;
      }
      return out;
    }
    /* where the snow can settle: top edges of cards, buttons, bars and sections, in page coordinates */
    function refresh() {
      var sy = window.scrollY || window.pageYOffset || 0;
      var head = document.querySelector('.site-head');
      topClip = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
      var next = [];
      function rad(v, wd) { return v && v.indexOf('%') > -1 ? parseFloat(v) / 100 * wd : parseFloat(v) || 0; }
      document.querySelectorAll(SURFACES).forEach(function (el) {
        var rects = el.getClientRects(), cs = getComputedStyle(el);
        for (var k = 0; k < rects.length; k++) {
          var r = rects[k];
          if (r.width < 24 || r.height < 4) continue;
          /* only the flat part of the top edge carries snow, not the rounded corners */
          var rl = rad(cs.borderTopLeftRadius, r.width), rr = rad(cs.borderTopRightRadius, r.width);
          var left = r.left + rl, wd = r.width - rl - rr;
          if (wd < 16) continue;
          var old = null;
          for (var j = 0; j < surfaces.length; j++) if (surfaces[j].el === el && surfaces[j].k === k) { old = surfaces[j]; break; }
          var n = Math.max(2, Math.ceil(wd / BUCKET));
          var sf = old || { el: el, k: k, hs: new Float32Array(n) };
          if (sf.hs.length !== n) sf.hs = resample(sf.hs, n);
          sf.x = left; sf.y = r.top + sy; sf.w = wd; sf.n = n;
          next.push(sf);
        }
      });
      surfaces = next;
    }
    function deposit(sf, b, f) {
      var amt = 2 + f.r * 1.4, wts = [0.03, 0.07, 0.13, 0.18, 0.2, 0.18, 0.13, 0.07, 0.03], i, o, d, m;
      for (o = -4; o <= 4; o++) { i = b + o; if (i >= 0 && i < sf.n) sf.hs[i] += amt * wts[o + 4]; }
      /* let it slide into soft mounds */
      for (var pass = 0; pass < 3; pass++) {
        for (i = Math.max(0, b - 10); i < Math.min(sf.n - 1, b + 10); i++) {
          d = sf.hs[i] - sf.hs[i + 1];
          if (d > 0.8) { m = (d - 0.8) / 2; sf.hs[i] -= m; sf.hs[i + 1] += m; }
          else if (d < -0.8) { m = (-d - 0.8) / 2; sf.hs[i] += m; sf.hs[i + 1] -= m; }
        }
      }
      /* rounded drifts that thin out at the edges */
      for (i = Math.max(0, b - 12); i < Math.min(sf.n, b + 12); i++) {
        var cap = Math.min(CAP, 1.2 + Math.min(i, sf.n - 1 - i) * BUCKET * 0.6);
        if (sf.hs[i] > cap) sf.hs[i] = cap;
      }
    }
    function make(y) {
      var big = Math.random() < 0.16;
      return {
        x: Math.random() * w, y: y, big: big, lands: Math.random() < 0.65,
        r: big ? 3 + Math.random() * 3.5 : 0.8 + Math.random() * 2.2,
        vy: 0.4 + Math.random() * 1.1, ph: Math.random() * 6.28, sw: 0.4 + Math.random() * 1.2,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.02, a: 0.6 + Math.random() * 0.4
      };
    }
    function count() { return Math.min(240, Math.round(w * h / 7000)); }
    function drawFlake(f) {
      ctx.globalAlpha = f.a;
      if (f.big) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.beginPath();
        for (var k = 0; k < 6; k++) {
          var an = k * Math.PI / 3, len = f.r * 1.6;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(an) * len, Math.sin(an) * len);
          ctx.moveTo(Math.cos(an) * len * 0.55, Math.sin(an) * len * 0.55);
          ctx.lineTo(Math.cos(an + 0.5) * len * 0.8, Math.sin(an + 0.5) * len * 0.8);
        }
        /* soft grey edge first, so flakes stay visible on white sections too */
        ctx.strokeStyle = 'rgba(' + tone('--slate-rgb') + ', 0.35)'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.strokeStyle = tone('--white'); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 0.8, 0, 6.283);
        ctx.fillStyle = 'rgba(' + tone('--slate-rgb') + ', 0.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283);
        ctx.fillStyle = tone('--white'); ctx.fill();
      }
    }
    function drawRun(sf, base, a, b) {
      var pts = [[sf.x + a * BUCKET, base]];
      for (var i = a; i <= b; i++) pts.push([Math.min(sf.x + sf.w, sf.x + (i + 0.5) * BUCKET), base - sf.hs[i]]);
      pts.push([Math.min(sf.x + sf.w, sf.x + (b + 1) * BUCKET), base]);
      var top = new Path2D();
      top.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length - 1; k++) {
        top.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      }
      top.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      var body = new Path2D(top);
      body.closePath();
      ctx.fillStyle = tone('--white');
      ctx.fill(body);
      ctx.strokeStyle = 'rgba(' + tone('--slate-rgb') + ', 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke(top);
    }
    function drawPiles(sy) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.rect(0, topClip, w, h - topClip); ctx.clip();
      for (var j = 0; j < surfaces.length; j++) {
        var sf = surfaces[j], base = sf.y - sy, i, mx = 0;
        if (base < topClip - CAP || base > h + 2) continue;
        for (i = 0; i < sf.n; i++) if (sf.hs[i] > mx) mx = sf.hs[i];
        if (mx < 0.4) continue;
        var run = -1;
        for (i = 0; i <= sf.n; i++) {
          var on = i < sf.n && sf.hs[i] > 0.35;
          if (on && run < 0) run = i;
          if (!on && run >= 0) { drawRun(sf, base, run, i - 1); run = -1; }
        }
      }
      ctx.restore();
    }
    function paint(now, move) {
      var sy = window.scrollY || window.pageYOffset || 0;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      var t = (now || 0) / 1000, vis = [], j;
      for (j = 0; j < surfaces.length; j++) {
        var base = surfaces[j].y - sy;
        if (base >= topClip && base <= h + CAP) vis.push(surfaces[j]);
      }
      for (var i = flakes.length - 1; i >= 0; i--) {
        var f = flakes[i];
        if (move) {
          f.y += f.vy * (f.big ? 0.8 : 1);
          f.x += Math.sin(t * f.sw + f.ph) * 0.5;
          f.rot += f.vr;
          var docY = f.y + sy, landed = false;
          if (f.lands && !f.big && f.prev !== undefined) {
            for (j = 0; j < vis.length; j++) {
              var sf = vis[j];
              if (f.x >= sf.x && f.x < sf.x + sf.w) {
                var b = Math.min(sf.n - 1, Math.floor((f.x - sf.x) / BUCKET)), L = sf.y - sf.hs[b];
                if (f.prev <= L && docY >= L) { deposit(sf, b, f); landed = true; break; }
              }
            }
          }
          f.prev = docY;
          if (landed || f.y - 12 > h) {
            if (stopping) { flakes.splice(i, 1); continue; }
            f = flakes[i] = make(-12);
          }
          if (f.x < -12) f.x = w + 12; else if (f.x > w + 12) f.x = -12;
        }
        if (f.y > -12) drawFlake(f);
      }
      ctx.globalAlpha = 1;
      drawPiles(sy);
    }
    function frame(now) {
      paint(now, true);
      if (stopping) {
        /* flakes fade out, the piles melt away */
        for (var q = flakes.length - 1; q >= 0; q--) { flakes[q].a *= 0.97; if (flakes[q].a < 0.04) flakes.splice(q, 1); }
        var left = 0;
        for (var j = 0; j < surfaces.length; j++) {
          var hs = surfaces[j].hs;
          for (var i = 0; i < hs.length; i++) { hs[i] *= 0.985; if (hs[i] > left) left = hs[i]; }
        }
        if (!flakes.length && left < 0.3) { teardown(); return; }
      }
      raf = requestAnimationFrame(frame);
    }
    function teardown() {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      clearInterval(refreshTimer);
      window.removeEventListener('resize', resize);
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      cv = null; ctx = null; flakes = []; surfaces = []; stopping = false;
    }
    function start() {
      if (cv) { stopping = false; clearTimeout(safety); return; }
      cv = document.createElement('canvas');
      cv.className = 'snow';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      ctx = cv.getContext('2d');
      surfaces = [];
      resize();
      window.addEventListener('resize', resize);
      refreshTimer = setInterval(refresh, 700);
      flakes = [];
      for (var n = count(), k = 0; k < n; k++) flakes.push(make(reduceMotion ? Math.random() * h : -Math.random() * h));
      if (reduceMotion) { paint(0, false); return; }
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (!cv) return;
      if (reduceMotion) { teardown(); return; }
      stopping = true;
      safety = setTimeout(teardown, 8000);
    }
    document.addEventListener('visibilitychange', function () {
      if (!cv || reduceMotion) return;
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    });
    return {
      toggle: function () {
        if (cv && !stopping) { stop(); return false; }
        start();
        return true;
      }
    };
  })();

  /* Mini terminal: a few real commands, a few jokes */
  (function miniCli() {
    var form = document.getElementById('cli-form');
    if (!form) return;
    var input = document.getElementById('cli-input');
    var out = document.getElementById('cli-out');
    var screen = document.getElementById('cli-screen') || out;
    var box = document.getElementById('cli');
    var LINKEDIN = 'https://www.linkedin.com/in/alexander-fuhr/';
    var COMMANDS = ['help', 'whoami', 'ls', 'cat', 'cd', 'pwd', 'quiz', 'contact', 'coffee',
      'lang', 'clear', 'exit', 'history', 'date', 'echo', 'ping', 'git', 'sudo', 'vim', 'ai', 'hack', '42', 'hangman'];
    var hist = [], hIdx = 0, busy = false, inVim = false;
    var emptyRuns = 0, unknownRuns = 0, askHelp = false, lastKnown = true;
    var promptText = 'guest@arfr:~$ ';

    function pad(s, n) { while (s.length < n) s += ' '; return s; }
    /* characters per line in the terminal, from the width of one character of its font */
    function cols() {
      var m = document.createElement('span');
      m.textContent = '0000000000';
      m.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      out.appendChild(m);
      var w = m.getBoundingClientRect().width / 10;
      out.removeChild(m);
      var cs = getComputedStyle(screen);
      return w ? Math.floor((screen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / w) : 80;
    }
    function line(text, cls) {
      var d = document.createElement('div');
      d.className = 'cli-line' + (cls ? ' ' + cls : '');
      d.textContent = text;
      out.appendChild(d);
      while (out.children.length > 200) out.removeChild(out.firstElementChild);
      screen.scrollTop = screen.scrollHeight;
    }
    function echoCmd(text) {
      var d = document.createElement('div');
      d.className = 'cli-line';
      var p = document.createElement('span');
      p.className = 'p';
      p.textContent = promptText;
      d.appendChild(p);
      d.appendChild(document.createTextNode(text));
      out.appendChild(d);
      screen.scrollTop = screen.scrollHeight;
    }
    function seq(items) {
      busy = true;
      var k = 0;
      (function next() {
        if (k >= items.length) { busy = false; return; }
        var it = items[k++];
        setTimeout(function () { line(it[0], it[1]); next(); }, reduceMotion ? 0 : (it[2] || 0));
      })();
    }
    function hex() {
      var s = '';
      for (var k = 0; k < 6; k++) s += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + ' ';
      return s;
    }
    function openLink(href) {
      var a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    function cmdButton(cmd, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cli-cmd';
      b.setAttribute('data-cmd', cmd);
      b.textContent = label;
      return b;
    }
    out.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.cli-cmd');
      if (!b || busy) return;
      run(b.getAttribute('data-cmd'));
    });
    function help() {
      var narrow = cols() < 56;
      line(t('cli.help.title'));
      [['help', 'cli.help.help'], ['whoami', 'cli.help.whoami'], ['ls', 'cli.help.ls'],
       ['cat profile.yml', 'cli.help.cat'], ['quiz', 'cli.help.quiz'], ['hangman', 'cli.help.hangman'], ['contact', 'cli.help.contact'],
       ['coffee', 'cli.help.coffee'], ['lang de|en|ru|sr|el', 'cli.help.lang'],
       ['clear', 'cli.help.clear'], ['exit', 'cli.help.exit']].forEach(function (r) {
        /* every command is a button that runs it; `lang` offers each language on its own */
        var d = document.createElement('div');
        d.className = 'cli-line ' + (narrow ? 'help-cmd' : 'muted');
        d.appendChild(document.createTextNode('  '));
        if (r[0].indexOf('lang ') === 0) {
          d.appendChild(document.createTextNode('lang '));
          r[0].slice(5).split('|').forEach(function (l, k) {
            if (k) d.appendChild(document.createTextNode('|'));
            d.appendChild(cmdButton('lang ' + l, l));
          });
        } else d.appendChild(cmdButton(r[0], r[0]));
        /* a narrow terminal (phones) has no room for two columns: the description goes on its own line below */
        if (!narrow) d.appendChild(document.createTextNode(pad('', 22 - r[0].length) + t(r[1])));
        out.appendChild(d);
        if (narrow) line(t(r[1]), 'muted help-desc');
      });
      line(t('cli.help.secret'), 'accent');
    }

    /* `hangman`: guess the hidden commands one after another */
    var HM_WORDS = ['bug', 'snow', 'smart', 'ascii', 'play'];
    var YES = /^(y|yes|j|ja|д|да|d|da|ν|ναι|nai)$/, NO = /^(n|no|nein|н|нет|ne|ο|όχι|οχι|oxi)$/;
    var hm = { on: false, idx: 0, solved: 0, word: '', hits: [], misses: [], board: null, ask: null };
    var cliPath = document.getElementById('cli-path');
    function hmPrompt(on) {
      promptText = on ? 'guest@arfr:~/hangman$ ' : 'guest@arfr:~$ ';
      if (cliPath) cliPath.textContent = on ? ':~/hangman$' : ':~$';
    }
    function hmDraw(reveal) {
      if (hm.board && hm.board.parentNode) hm.board.parentNode.removeChild(hm.board);
      var w = hm.misses.length, left = 6 - w;
      var shown = hm.word.split('').map(function (ch) { return reveal || hm.hits.indexOf(ch) !== -1 ? ch : '_'; }).join(' ');
      var rows = [
        [['  +---+   ', 'm']],
        [['  |   |   ', 'm'], [shown, null]],
        [['  ', 'm'], [w >= 1 ? 'O' : ' ', 'g'], ['   |   ', 'm']],
        [[' ', 'm'], [(w >= 3 ? '/' : ' ') + (w >= 2 ? '|' : ' ') + (w >= 4 ? '\\' : ' '), 'g'], ['  |   ', 'm'], [hm.misses.length ? '✗ ' + hm.misses.join(' ') : '', 'f']],
        [[' ', 'm'], [(w >= 5 ? '/' : ' ') + ' ' + (w >= 6 ? '\\' : ' '), 'g'], ['  |   ', 'm'], [reveal ? '' : (left === 1 ? t('hm.left1') : t('hm.left').replace('{n}', left)), 'm']],
        [['      |', 'm']],
        [['=========', 'm']]
      ];
      var pre = document.createElement('pre');
      pre.className = 'cli-art cli-hm';
      rows.forEach(function (row, k) {
        row.forEach(function (seg) {
          var sp = document.createElement('span');
          if (seg[1]) sp.className = seg[1];
          sp.textContent = seg[0];
          pre.appendChild(sp);
        });
        if (k < rows.length - 1) pre.appendChild(document.createTextNode('\n'));
      });
      out.appendChild(pre);
      hm.board = pre;
      screen.scrollTop = screen.scrollHeight;
    }
    function hmRound() {
      hm.word = HM_WORDS[hm.idx];
      hm.hits = []; hm.misses = []; hm.board = null; hm.ask = null;
      line(t('hm.start').replace('{n}', hm.idx + 1).replace('{total}', HM_WORDS.length), 'accent');
      line(t('hm.hintLabel') + ': ' + t('hm.h.' + hm.word), 'muted');
      hmDraw(false);
    }
    function hmStart() {
      hm.on = true;
      askHelp = false;
      hmPrompt(true);
      if (hm.idx >= HM_WORDS.length) { hm.ask = 'again'; line(t('hm.again'), 'accent'); return; }
      line(t('hm.howto'), 'muted');
      hmRound();
    }
    function hmStop(msg) {
      hm.on = false; hm.ask = null; hm.board = null;
      hmPrompt(false);
      if (msg) line(msg, 'muted');
    }
    function hmFinish(won) {
      hmDraw(true);
      if (won) {
        hm.solved += 1;
        line(t('hm.win').replace('{w}', hm.word) + (hm.word === 'bug' ? ' ' + t('hm.win.bug') : ''), 'accent');
      } else {
        line(t('hm.lose').replace('{w}', hm.word), 'err');
      }
      hm.board = null;
      hm.idx += 1;
      if (hm.idx >= HM_WORDS.length) {
        line(hm.solved === HM_WORDS.length ? t('hm.all').replace('{total}', HM_WORDS.length)
          : t('hm.done').replace('{total}', HM_WORDS.length).replace('{n}', hm.solved), 'accent');
        hmStop();
        return;
      }
      hm.ask = 'next';
      line(t('hm.next'), 'accent');
    }
    function hmInput(cmd) {
      var v = cmd.trim().toLowerCase();
      /* single letters are guesses, so a bare q is one too */
      if (/^(exit|quit|:q|:q!)$/.test(v)) { hmStop(t('hm.bye')); return; }
      if (hm.ask) {
        var a = hm.ask;
        if (!v || YES.test(v)) {
          if (a === 'again') { hm.idx = 0; hm.solved = 0; line(t('hm.howto'), 'muted'); }
          hmRound();
        } else if (NO.test(v)) hmStop(t('hm.bye'));
        else line(t(a === 'again' ? 'hm.again' : 'hm.next'), 'accent');
        return;
      }
      if (!v) { hmDraw(false); return; }
      if (v === 'clear' || v === 'cls') { out.textContent = ''; hm.board = null; hmDraw(false); return; }
      if (v === 'help' || v === '?') { line(t('hm.howto'), 'muted'); hmDraw(false); return; }
      if (v === 'hint') { line(t('hm.hintLabel') + ': ' + t('hm.h.' + hm.word), 'muted'); hmDraw(false); return; }
      if (!/^[a-z]+$/.test(v)) { line(t('hm.bad'), 'err'); hmDraw(false); return; }
      if (v.length > 1) {
        if (v === hm.word) { hm.hits = hm.word.split(''); hmFinish(true); return; }
        line(t('hm.wrongWord').replace('{w}', v), 'err');
        hm.misses.push(v);
      } else if (hm.hits.indexOf(v) !== -1 || hm.misses.indexOf(v) !== -1) {
        line(t('hm.dup').replace('{l}', v), 'muted');
        hmDraw(false);
        return;
      } else if (hm.word.indexOf(v) !== -1) {
        hm.hits.push(v);
        if (hm.word.split('').every(function (ch) { return hm.hits.indexOf(ch) !== -1; })) { hmFinish(true); return; }
      } else {
        hm.misses.push(v);
      }
      if (hm.misses.length >= 6) { hmFinish(false); return; }
      hmDraw(false);
    }
    /* Hidden command `ascii`: an ASCII rocket launches into space */
    var anim = null;
    var ROCKET = ['    /\\    ', '   /  \\   ', '  | () |  ', '  |    |  ', '  |    |  ', ' /|    |\\ ', '/_|____|_\\'];
    var FLAMES = [
      ['   ****   ', '    **    ', '    ..    '],
      ['   *##*   ', "   '**'   ", '     .    '],
      ['   #**#   ', '    ##    ', "    ''    "]
    ];
    function asciiRocket() {
      busy = true;
      line(t('cli.ascii.hint'), 'muted');
      var pre = document.createElement('pre');
      pre.className = 'cli-art';
      pre.setAttribute('aria-hidden', 'true');
      out.appendChild(pre);
      var probe = document.createElement('span');
      probe.textContent = 'MMMMMMMMMM';
      pre.appendChild(probe);
      var chW = probe.getBoundingClientRect().width / 10 || 9;
      var lineH = parseFloat(getComputedStyle(pre).lineHeight) || chW * 1.9;
      pre.textContent = '';
      var W = Math.max(24, Math.min(48, Math.floor((screen.clientWidth - 28) / chW)));
      var H = Math.max(12, Math.floor((screen.clientHeight - 24) / lineH) - 2);
      var rx = Math.floor(W / 2) - 5, padY = H - 8, cruiseY = Math.max(1, Math.floor((H - 10) / 2));
      var n = 0, timer = 0, total = 165, groundY = H - 1;
      var stars = [];
      for (var k = 0; k < Math.floor(W * H / 16); k++) {
        stars.push({ x: Math.floor(Math.random() * W), y: Math.random() * H, d: 0.5 + Math.random(), c: "..*+'".charAt(Math.floor(Math.random() * 5)) });
      }
      function esc(c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c; }
      function render() {
        var cells = new Array(W * H);
        function put(ch, cl, x, y) {
          x = Math.round(x); y = Math.round(y);
          if (x >= 0 && x < W && y >= 0 && y < H) cells[y * W + x] = [ch, cl];
        }
        var speed = n < 60 ? 0 : (n < 120 ? 0.45 : 0.45 + (n - 120) * 0.05);
        if (n >= 60) groundY = H - 1 + Math.floor((n - 60) * 0.45);
        stars.forEach(function (st) {
          if (speed) {
            st.y += speed * st.d;
            if (st.y >= H) { st.y -= H; st.x = Math.floor(Math.random() * W); }
          }
          if (Math.floor(st.y) < groundY) put(st.c, 's', st.x, Math.floor(st.y));
        });
        if (groundY < H) {
          for (var gx = 0; gx < W; gx++) put('=', 'g', gx, groundY);
          for (var ti = 1; ti <= 6; ti++) put('#', 'g', rx - 3, groundY - ti);
        }
        var ry;
        if (n < 30) ry = padY;
        else if (n < 60) { var pr = (n - 30) / 30; ry = padY - (padY - cruiseY) * pr * pr; }
        else if (n < 120) ry = cruiseY;
        else ry = cruiseY - Math.pow(n - 120, 1.6) * 0.25;
        ry = Math.round(ry);
        if (n >= 18) {
          var fl = FLAMES[n % 3], rows = n < 30 ? 1 : 3;
          for (var fi = 0; fi < rows; fi++) {
            for (var fc = 0; fc < fl[fi].length; fc++) if (fl[fi].charAt(fc) !== ' ') put(fl[fi].charAt(fc), 'f', rx + fc, ry + 7 + fi);
          }
        }
        if (n >= 18 && n < 48 && groundY < H) {
          var spread = Math.min(9, Math.floor((n - 18) / 2));
          for (var si = 1; si <= spread; si++) {
            var sc = si % 2 ? '~' : '-';
            put(sc, 'm', rx + 2 - si, groundY - 1);
            put(sc, 'm', rx + 7 + si, groundY - 1);
          }
        }
        ROCKET.forEach(function (row, ri) {
          /* the hull is opaque: stars must not shine through it */
          var first = row.search(/\S/), last = row.length - 1;
          while (last > first && row.charAt(last) === ' ') last--;
          for (var rc = first; rc <= last; rc++) put(row.charAt(rc), 'r', rx + rc, ry + ri);
        });
        var hud = n < 10 ? 'T-3' : n < 20 ? 'T-2' : n < 30 ? 'T-1' : n < 42 ? 'LIFTOFF' : 'ALT ' + Math.round(Math.pow(n - 30, 2) * 0.025) + ' km';
        for (var hc = 0; hc < hud.length; hc++) put(hud.charAt(hc), 'g', 1 + hc, 0);
        var html = '';
        for (var y = 0; y < H; y++) {
          var cur = null;
          for (var x = 0; x < W; x++) {
            var cell = cells[y * W + x], cl = cell ? cell[1] : '', ch = cell ? cell[0] : ' ';
            if (cl !== cur) {
              if (cur) html += '</span>';
              if (cl) html += '<span class="' + cl + '">';
              cur = cl;
            }
            html += esc(ch);
          }
          if (cur) html += '</span>';
          if (y < H - 1) html += '\n';
        }
        pre.innerHTML = html;
      }
      function stop(interrupted) {
        clearTimeout(timer);
        anim = null;
        if (interrupted) line('^C', 'muted');
        line(t('cli.ascii.end'), 'accent');
        busy = false;
      }
      anim = { stop: stop };
      if (reduceMotion) { n = 80; groundY = H; render(); stop(false); return; }
      (function step() {
        render();
        screen.scrollTop = screen.scrollHeight;
        n += 1;
        if (n < total) timer = setTimeout(step, 50); else stop(false);
      })();
    }

    function run(raw, remote) {
      var cmd = raw.trim();
      lastKnown = true;
      echoCmd(raw);
      if (hm.on && !remote) { hmInput(cmd); return; }
      /* after the nudge: Enter or yes runs help, no shrugs, anything else is a normal command */
      if (askHelp) {
        askHelp = false;
        var ans = cmd.toLowerCase();
        if (!ans || /^(y|yes|j|ja|д|да|d|da|ν|ναι|nai)$/.test(ans)) { run('help'); return; }
        if (/^(n|no|nein|н|нет|ne|ο|όχι|οχι|oxi)$/.test(ans)) { line(t('cli.enter3.no'), 'muted'); return; }
      }
      /* three empty Enters in a row: ask whether help would not be the better idea */
      if (!cmd) {
        if (!inVim && ++emptyRuns >= 3) { emptyRuns = 0; askHelp = true; line(t('cli.enter3'), 'accent'); }
        return;
      }
      emptyRuns = 0;
      /* any known command resets the unknown streak; the default branch picks it up again */
      var unknownBefore = unknownRuns;
      unknownRuns = 0;
      hist.push(cmd);
      hIdx = hist.length;
      var low = cmd.toLowerCase();
      var head = low.split(/\s+/)[0];
      var arg = cmd.slice(head.length).trim();
      var argLow = arg.toLowerCase();

      if (inVim) {
        if (/^:(q!?|wq!?|x)$/.test(low)) { inVim = false; line(t('cli.vimExit'), 'accent'); }
        else line('E37: No write since last change (add ! to override)', 'err');
        return;
      }
      if (head === 'sudo') { line(t('cli.sudo'), 'err'); return; }
      if (head === 'rm') {
        seq([[t('cli.rm1'), 'err'], ['removed /bin', 'muted', 350], ['removed /etc', 'muted', 300],
             ['removed /home/alex', 'muted', 300], [t('cli.rm2'), 'accent', 700]]);
        return;
      }
      if (head === 'git') {
        if (/\bpush\b/.test(argLow) && /(--force|\s-f\b|^-f\b|push -f)/.test(argLow)) line(t('cli.gitForce'), 'err');
        else line('On branch main\nnothing to commit, working tree clean');
        return;
      }
      switch (head) {
        case 'help': case 'man': case '?': help(); break;
        case 'whoami': case 'who': line(t('cli.whoami')); break;
        case 'ls': case 'dir': case 'll':
          if (argLow.indexOf('secret') !== -1) line(t('cli.denied'), 'err');
          else line('about.txt  profile.yml  quiz/  contact.sh  coffee.exe  secrets/');
          break;
        case 'cat': case 'less': case 'more':
          if (argLow === 'profile.yml') {
            line('name:     Alexander Fuhr');
            line('role:     ' + t('role.title'));
            line('workflow: ' + t('profile.workflow'));
            line('ai:       { role: assist, decides: false }');
          } else if (argLow === 'about.txt') {
            line(t('about.text')); line(t('about.text2'));
          } else if (argLow === 'contact.sh') {
            line('#!/bin/sh\nmail hello@arfr.de');
          } else if (argLow.indexOf('secret') !== -1) {
            line(t('cli.denied'), 'err');
          } else {
            line(head + ': ' + t('cli.noFile').replace('{f}', arg || '?'), 'err');
          }
          break;
        case 'cd':
          if (!arg || arg === '~') break;
          if (argLow.indexOf('secret') !== -1 || arg === '..' || arg === '/') line(t('cli.denied'), 'err');
          else line('cd: ' + t('cli.noFile').replace('{f}', arg), 'err');
          break;
        case 'pwd': line('/home/guest'); break;
        case 'hangman': case 'galgen': case 'galgenmännchen':
          hmStart();
          break;
        case 'quiz': case './quiz':
          line(t('cli.quiz'), 'accent');
          var again = document.querySelector('.quiz-again');
          if (again) again.click();
          setTimeout(function () {
            var top = document.getElementById('top');
            if (top) top.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
          }, reduceMotion ? 0 : 600);
          break;
        case 'contact': case 'mail': case './contact.sh': case 'sh':
          line(t('cli.contact'));
          window.location.href = 'mailto:hello@arfr.de?subject=' + encodeURIComponent(t('next.subject'));
          break;
        case 'play': case './lightrace': case 'lightrace':
          if (!game) { line(t('cli.notFound').replace('{cmd}', head), 'err'); break; }
          line(t('cli.play'), 'accent');
          busy = true;
          setTimeout(function () {
            busy = false;
            game.open(function (h, a) {
              line(t('cli.playEnd').replace('{h}', h).replace('{a}', a), 'muted');
            });
          }, reduceMotion ? 0 : 700);
          break;
        case 'coffee': case './coffee.exe': case 'brew': case 'make':
          seq([[t('cli.coffee1')], ['[###       ]  30 %', 'muted', 400], ['[######    ]  60 %', 'muted', 400],
               ['[##########] 100 %', 'muted', 400], [t('cli.coffee2'), 'accent', 300]]);
          break;
        case 'lang':
          if (LANGS.indexOf(argLow) !== -1) { setLang(argLow, true); line(t('cli.lang'), 'accent'); }
          else line('lang de | en | ru | sr | el', 'muted');
          break;
        case 'clear': case 'cls': out.textContent = ''; break;
        case 'exit': case 'logout': case 'quit': case ':q': case ':q!': case ':wq':
          seq([['logout', 'muted'], [t('cli.exit2'), 'muted', 500], [t('cli.exit3'), 'accent', 1300]]);
          break;
        case 'history':
          hist.forEach(function (h, k) { line(pad(String(k + 1), 4) + h, 'muted'); });
          break;
        case 'date': line(new Date().toLocaleString(current === 'en' ? 'en-GB' : (HTML_LANG[current] || current))); break;
        case 'echo': line(arg); break;
        case 'ping': line(t('cli.ping')); break;
        case 'vim': case 'vi': case 'nvim': case 'emacs': case 'nano':
          inVim = true;
          line(t('cli.vim'), 'accent');
          break;
        case 'ai': case 'chatgpt': case 'gpt': case 'claude': case 'ask':
          line(t('cli.ai'));
          break;
        case 'hack':
          seq([[hex(), 'muted'], [hex(), 'muted', 150], [hex(), 'muted', 150], [hex(), 'muted', 150],
               ['ACCESS GRANTED', 'accent', 400], [t('cli.hack2'), null, 900]]);
          break;
        case '42': line(t('cli.42')); break;
        case 'ascii': case 'rocket': case 'launch': asciiRocket(); break;
        case 'smart': case 'tldr': case 'compress':
          /* a second `smart` (e.g. sent from the chat) brings the full page back */
          if (smartMode.isOn()) {
            smartMode.exit(function () { window.scrollTo(0, 0); });
            line(t('cli.smart.back'), 'accent');
            break;
          }
          var st = smartMode.measure();
          seq([[t('cli.smart.1').replace('{n}', fmtNum(st.full))],
               [t('cli.smart.2'), 'muted', 500],
               [t('cli.smart.3').replace('{full}', fmtNum(st.full)).replace('{min}', fmtNum(st.min)).replace('{pct}', st.pct), 'accent', 600]]);
          setTimeout(smartMode.enter, reduceMotion ? 0 : 1900);
          break;
        case 'bug':
          if (bug.active()) { line(t('cli.bug.again'), 'muted'); break; }
          line(t('cli.bug.start'), 'accent');
          bug.start(function () { line(t('cli.bug.done'), 'muted'); });
          break;
        case 'fix': case 'undo': case 'debug':
          if (bug.active()) { bug.restore(); line(t('cli.bug.fixed'), 'accent'); }
          else line(t('cli.bug.nothing'), 'muted');
          break;
        case 'snow': case 'let-it-snow':
          line(t(snow.toggle() ? 'cli.snow.on' : 'cli.snow.off'), 'accent');
          break;
        case 'hi': case 'hello': case 'hallo': case 'hey': case 'moin': case 'привет': case 'zdravo': case 'ćao': case 'cao': case 'γεια': case 'γειά':
          line(t('cli.hello'));
          break;
        default:
          lastKnown = false;
          line(t('cli.notFound').replace('{cmd}', head), 'err');
          unknownRuns = unknownBefore + 1;
          if (unknownRuns >= 3) { unknownRuns = 0; askHelp = true; line(t('cli.unknown3'), 'accent'); }
      }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var v = input.value;
      input.value = '';
      sizeInput();
      run(v);
    });
    /* typed for the visitor (e.g. the "Kaffee" button): scroll here, type the command letter by letter, run it */
    var typing = false;
    document.addEventListener('arfr:type', function (e) {
      var d = e.detail || {};
      var c = String(d.cmd || '');
      if (!c) return;
      d.ok = true;
      if (typing) return;
      typing = true;
      if (anim) anim.stop(true);
      box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      function finish() { typing = false; input.value = ''; sizeInput(); run(c, true); }
      if (reduceMotion) { finish(); return; }
      var k = 0;
      setTimeout(function step() {
        if (busy) { setTimeout(step, 300); return; }
        k += 1;
        input.value = c.slice(0, k);
        sizeInput();
        if (k < c.length) setTimeout(step, 110); else setTimeout(finish, 380);
      }, 800);
    });
    /* remote control: a chat reply like "_snow" runs here, as if it had been typed */
    document.addEventListener('arfr:cli', function (e) {
      var d = e.detail || {};
      var c = String(d.cmd || '').trim();
      if (!c || busy) return;
      if (anim) anim.stop(true);
      inVim = false;
      askHelp = false;
      run(c, true);
      d.ran = true;
      d.known = lastKnown;
    });
    input.addEventListener('keydown', function (e) {
      if (anim) { e.preventDefault(); anim.stop(true); return; }
      if (e.key === 'ArrowUp') {
        if (hIdx > 0) { hIdx -= 1; input.value = hist[hIdx]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (hIdx < hist.length - 1) { hIdx += 1; input.value = hist[hIdx]; }
        else { hIdx = hist.length; input.value = ''; }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        var v = input.value.trim().toLowerCase();
        if (!v || v.indexOf(' ') !== -1) return;
        var m = COMMANDS.filter(function (c) { return c.indexOf(v) === 0; });
        if (m.length === 1) { input.value = m[0] + ' '; e.preventDefault(); }
        else if (m.length > 1) { line(m.join('  '), 'muted'); e.preventDefault(); }
      }
    });
    box.addEventListener('click', function (e) {
      if (anim) anim.stop(true);
      if (e.target.closest && e.target.closest('button')) return;
      var sel = window.getSelection ? String(window.getSelection()) : '';
      if (!sel) input.focus({ preventScroll: true });
    });
    var smartBack = document.getElementById('smart-back');
    if (smartBack) smartBack.addEventListener('click', function () {
      smartMode.exit(function () {
        box.scrollIntoView({ behavior: 'auto', block: 'center' });
        line(t('cli.smart.back'), 'accent');
        input.focus({ preventScroll: true });
      });
    });
    document.querySelectorAll('.cli-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        if (busy) return;
        run(b.getAttribute('data-cmd'));
      });
    });
    /* input grows with the text, so the idle block cursor sits right after it */
    function sizeInput() { input.style.setProperty('--len', String(input.value.length)); }
    input.addEventListener('input', sizeInput);
    input.addEventListener('keyup', sizeInput);
    sizeInput();
  })();

  /* The fades before the top and bottom tab match the section under them, the page or the terminal band; over the hero
     they step aside. Only sections count, so a white bar of text passing by never tints them */
  (function frameFades() {
    var frame = document.querySelector('.frame');
    if (!frame || !document.elementsFromPoint) return;
    var root = document.documentElement, queued = false, band = 'rgb(' + tone('--term-bg-rgb') + ')';
    function under(y) {
      var hits = document.elementsFromPoint(Math.round(window.innerWidth * 0.12), y), sec = null;
      for (var i = 0; i < hits.length && !sec; i++) sec = hits[i].closest('main section');
      return sec;
    }
    function ground(sec) {
      if (!sec) return getComputedStyle(document.body).backgroundColor;
      var c = getComputedStyle(sec).backgroundColor;
      if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c;
      /* the dark bands blend into the page with a gradient, so their colour is not a background colour */
      return sec.matches('.about-band, .next-band') ? band : getComputedStyle(document.body).backgroundColor;
    }
    function paint() {
      queued = false;
      if (root.classList.contains('slides')) return;
      var edge = frameInset();
      var top = under(edge + 20), bottom = under(window.innerHeight - edge - 20);
      frame.style.setProperty('--fade-top', ground(top));
      frame.style.setProperty('--fade-bottom', ground(bottom));
      frame.classList.toggle('space-top', !!top && top.classList.contains('hero'));
      frame.classList.toggle('space-bottom', !!bottom && bottom.classList.contains('hero'));
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(paint); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    paint();
  })();

  /* Space behind the hero: the frame is a window in orbit. A still sky of stars, and the Earth curving up out of the
     lower left corner, drawn from NASA's Blue Marble images: day surface, clouds, city lights on the night side and a
     thin blue atmosphere. The planet turns under the window, the clouds drift over it */
  (function orbitWindow() {
    var hero = document.querySelector('.hero');
    var sky = document.querySelector('.retro-grid');
    if (!hero || !sky || !sky.getContext) return;
    var CYAN = tone('--human-rgb'), AMBER = tone('--ai-rgb'), WHITE = tone('--white-rgb');
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

    var w = 0, h = 0, dpr = 1, circle = [0, 0, 1];
    function layout() {
      var r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      if (!w || !h) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      /* the rim runs from the left edge, under the text, down to the bottom edge past the middle */
      var phone = w < 860, side = hero.querySelector('.hero-side');
      var top = phone && side ? side.getBoundingClientRect().bottom - r.top + 40 : h * 0.6;
      var x1 = 0, y1 = top, x2 = phone ? w * 0.95 : w * 0.58, y2 = phone ? top + w * 0.75 : h;
      var R = phone ? w * 2.2 : Math.max(w, h) * 1.3;
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
      var k = Math.sqrt(Math.max(0, R * R - d * d / 4)) / d;
      circle = [mx - dy * k, my + dx * k, R];
      /* stars: many faint, a few bright, the same sky on every visit */
      sky.width = Math.round(w * dpr); sky.height = Math.round(h * dpr);
      var sc = sky.getContext('2d'); sc.setTransform(dpr, 0, 0, dpr, 0, 0); sc.clearRect(0, 0, w, h);
      var rand = rng(20261021), n = Math.round(w * h / 900);
      for (var i = 0; i < n; i++) {
        var x = rand() * w, y = rand() * h, s = rand(), a = 0.1 + rand() * 0.5;
        var tint = s > 0.96 ? CYAN : s > 0.93 ? AMBER : WHITE;
        if (s > 0.993) {
          var g = sc.createRadialGradient(x, y, 0, x, y, 3);
          g.addColorStop(0, 'rgba(' + WHITE + ',0.9)'); g.addColorStop(1, 'rgba(' + WHITE + ',0)');
          sc.fillStyle = g; sc.fillRect(x - 3, y - 3, 6, 6);
          continue;
        }
        sc.fillStyle = 'rgba(' + tint + ',' + a + ')';
        sc.beginPath(); sc.arc(x, y, s > 0.85 ? 0.75 : 0.45, 0, Math.PI * 2); sc.fill();
      }
      return true;
    }

    /* the planet: one full screen triangle; every pixel inside the circle finds its point on the sphere */
    var cv = document.createElement('canvas');
    cv.className = 'retro-grid';
    cv.setAttribute('aria-hidden', 'true');
    sky.after(cv);
    var gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { cv.remove(); layout(); return; }
    var VS = '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
    var FS = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec2 uRes; uniform float uDpr; uniform vec3 uCircle; uniform float uSpin; uniform float uDrift; uniform vec3 uSun; uniform float uLoaded;',
      'uniform sampler2D uDay, uNight, uClouds;',
      'out vec4 o;',
      'const float PI = 3.14159265;',
      'mat3 rotY(float t){ float c = cos(t), s = sin(t); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }',
      'mat3 rotX(float t){ float c = cos(t), s = sin(t); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }',
      'void main(){',
      '  vec2 px = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;',
      '  vec2 p = vec2(px.x - uCircle.x, uCircle.y - px.y) / uCircle.z;',
      '  float d = length(p);',
      '  vec3 air = vec3(0.30, 0.62, 1.0);',
      '  float lit = clamp(dot(normalize(vec3(p, 0.0)), uSun) * 0.9 + 0.35, 0.0, 1.0);',
      '  if (d > 1.0) {',
      '    float out_ = (d - 1.0) * uCircle.z;',
      '    float hz = (exp(-out_ / 10.0) * 0.85 + exp(-out_ / 70.0) * 0.28) * lit;',
      '    o = vec4(air * hz, hz); return;',
      '  }',
      '  vec3 n = vec3(p, sqrt(1.0 - d * d));',
      '  vec3 m = rotY(uSpin) * rotX(0.45) * n;',
      '  vec2 uv = vec2(atan(m.x, m.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(m.y, -1.0, 1.0)) / PI);',
      '  vec2 gx = dFdx(uv), gy = dFdy(uv);',
      '  if (abs(gx.x) > 0.5) gx.x -= sign(gx.x);',
      '  if (abs(gy.x) > 0.5) gy.x -= sign(gy.x);',
      '  vec3 day = textureGrad(uDay, uv, gx, gy).rgb;',
      '  float city = textureGrad(uNight, uv, gx, gy).r;',
      '  float cloud = textureGrad(uClouds, uv + vec2(uDrift, 0.0), gx, gy).r;',
      '  float ndl = dot(n, uSun);',
      '  float dayk = smoothstep(-0.1, 0.2, ndl);',
      '  vec3 col = day * (0.04 + 1.15 * max(ndl, 0.0));',
      '  col = mix(col, vec3(0.97, 0.98, 1.0) * (0.03 + 1.1 * max(ndl, 0.0)), cloud * 0.92);',
      '  col += vec3(1.0, 0.72, 0.4) * pow(city, 1.6) * (1.0 - dayk) * (1.0 - cloud) * 1.1;',
      '  float limb = pow(1.0 - n.z, 3.0);',
      '  col = mix(col, air * (0.15 + 1.1 * max(ndl + 0.15, 0.0)), clamp(limb * 1.4, 0.0, 0.9));',
      '  col += air * exp(-(1.0 - d) * uCircle.z / 2.5) * 0.7 * lit;',
      '  col = mix(vec3(0.01, 0.015, 0.03), col, uLoaded);',
      '  o = vec4(col, 1.0);',
      '}'
    ].join('\n');
    function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['uRes', 'uDpr', 'uCircle', 'uSpin', 'uDrift', 'uSun', 'uLoaded', 'uDay', 'uNight', 'uClouds'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    var aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    /* small copies of the three maps ride along in the page, so the Earth is there at once (and when the page
       is opened straight from disk, where the browser keeps image files away from WebGL); the sharp maps replace them */
    var PREVIEW = {
      day: 'data:image/webp;base64,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',
      night: 'data:image/webp;base64,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',
      clouds: 'data:image/webp;base64,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'
    };
    var ready = [false, false, false], fade = 0;
    /* phones get the day and cloud maps at half size (a third of the weight, 0.5 instead of 1.7 MB), and so does anyone
       whose browser asks to save data; the night map is small already */
    var half = Math.min(screen.width, screen.height) < 600 || !!(navigator.connection && navigator.connection.saveData);
    function texture(unit, name, uni) {
      var t = gl.createTexture(), sharp = false;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([4, 8, 16, 255]));
      gl.uniform1i(U[uni], unit);
      function put(img, full) {
        if (sharp) return;
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { return; }
        sharp = full;
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        ready[unit] = true;
        if (!running) render(clock);
      }
      var low = new Image(), img = new Image();
      low.onload = function () { put(low, false); };
      img.onload = function () { put(img, true); };
      low.src = PREVIEW[name];
      img.src = 'images/space/earth-' + name + (half && name !== 'night' ? '-2k' : '') + '.webp';
    }
    texture(0, 'day', 'uDay');
    texture(1, 'night', 'uNight');
    texture(2, 'clouds', 'uClouds');
    var sun = [0.7, 0.5, -0.5], sl = Math.hypot(sun[0], sun[1], sun[2]);

    function size() {
      if (!layout()) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
    }
    var clock = 0;
    function render(t) {
      if (ready[0] && ready[1] && ready[2]) fade = running ? Math.min(1, fade + 0.04) : 1;
      gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uDpr, dpr);
      gl.uniform3f(U.uCircle, circle[0], circle[1], circle[2]);
      /* the ground passes under the window at about 30 px a second; the clouds drift a little on their own */
      gl.uniform1f(U.uSpin, 2.2 + t / 1000 * 30 / circle[2]);
      gl.uniform1f(U.uDrift, 0.004 + t / 1000 * 0.00025);
      gl.uniform3f(U.uSun, sun[0] / sl, sun[1] / sl, sun[2] / sl);
      gl.uniform1f(U.uLoaded, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    var raf = 0, running = false, onScreen = true, covered = false, paused = false, prev = 0;
    try { paused = localStorage.getItem('arfr-earth') === 'paused'; } catch (e) {}
    function loop(now) {
      clock += prev ? Math.min(now - prev, 100) : 0; prev = now; render(clock);
      if (running) raf = requestAnimationFrame(loop);
    }
    function start() { if (running || paused || reduceMotion || !onScreen || covered || document.hidden) return; running = true; prev = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    size(); render(0); start();
    if ('ResizeObserver' in window) new ResizeObserver(function () { size(); render(clock); }).observe(hero);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; if (onScreen) start(); else stop(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    /* while the quiz covers the hero the Earth is faded out, so it rests instead of drawing frames nobody sees */
    new MutationObserver(function () { covered = hero.classList.contains('quiz-shown'); if (covered) stop(); else start(); }).observe(hero, { attributes: true, attributeFilter: ['class'] });
    /* the pause button stops the turning and remembers it for the next visit; with reduced motion nothing turns, so it stays hidden */
    var hold = document.getElementById('earth-pause');
    if (hold && !reduceMotion) {
      var holdLabel = function () {
        var l = t(paused ? 'earth.play' : 'earth.pause');
        hold.setAttribute('aria-label', l); hold.title = l;
        hold.classList.toggle('is-paused', paused);
      };
      hold.addEventListener('click', function () {
        paused = !paused;
        try { if (paused) localStorage.setItem('arfr-earth', 'paused'); else localStorage.removeItem('arfr-earth'); } catch (e) {}
        holdLabel();
        if (paused) stop(); else start();
      });
      holdLabel();
      document.addEventListener('arfr:lang', holdLabel);
      hold.hidden = false;
    }
  })();

  /* Review carousel: slides through the examples, pauses while hovered or focused */
  (function reviewCarousel() {
    var root = document.querySelector('.carousel');
    if (!root) return;
    var fig = root.closest('figure');
    var track = root.querySelector('.track');
    var slides = Array.prototype.slice.call(track.children);
    var dotsWrap = fig.querySelector('.dots');
    var n = slides.length, i = 0, timer = null, paused = false;
    var bonusIdx = -1;
    slides.forEach(function (s, k) { if (s.hasAttribute('data-cta')) bonusIdx = k; });
    var unlocked = bonusIdx < 0;
    function count() { return unlocked ? slides.length : bonusIdx; }
    /* the ladder: one step per question, a click goes there */
    var dots = dotsWrap ? slides.map(function (s, k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', s.getAttribute('data-name'));
      b.addEventListener('click', function () { hideResult(); goTo(k, true); });
      dotsWrap.appendChild(b);
      return b;
    }) : [];
    function lockDots() { if (bonusIdx >= 0 && dots[bonusIdx]) dots[bonusIdx].hidden = !unlocked; }
    lockDots();
    document.addEventListener('arfr:bonus', function (e) {
      unlocked = !!(e.detail && e.detail.unlock) || bonusIdx < 0;
      lockDots();
      if (unlocked) goTo(bonusIdx, true); else if (i >= count()) goTo(0, true);
    });
    function next() {
      if (resultOpen()) { hideResult(); goTo(i + 1, true); return; }
      if (i === count() - 1 && quizComplete()) { showResult(); return; }
      goTo(i + 1, true);
    }
    function prev() {
      if (resultOpen()) { hideResult(); return; }
      goTo(i - 1, true);
    }
    function goTo(k, byUser) {
      n = count();
      var was = i;
      i = (k + n) % n;
      /* where the question scrolls inside its box (phones), a new one starts at its top */
      var box = i !== was && slides[i].closest('.stage-body');
      if (box) box.scrollTop = 0;
      slides.forEach(function (s, j) {
        var on = j === i;
        s.classList.toggle('is-current', on);
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in s) s.inert = !on;
      });
      dots.forEach(function (d, j) {
        d.setAttribute('aria-current', j === i ? 'true' : 'false');
        d.tabIndex = j === i ? 0 : -1;
      });
      label();
    }
    quizGo = function (k) { goTo(k, true); };
    /* the ladder is one stop for the keyboard; left, right, Home and End move along it */
    if (dotsWrap) dotsWrap.addEventListener('keydown', function (e) {
      var m = count(), to = null;
      if (e.key === 'ArrowRight') to = (i + 1) % m;
      else if (e.key === 'ArrowLeft') to = (i - 1 + m) % m;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = m - 1;
      if (to === null) return;
      e.preventDefault();
      hideResult();
      goTo(to, true);
      dots[to].focus({ preventScroll: true });
    });
    /* each step of the ladder says its question and, once answered, right or wrong */
    function label() {
      dots.forEach(function (d, k) {
        var how = d.classList.contains('is-right') ? 'quiz.right' : d.classList.contains('is-wrong') ? 'quiz.wrong' : '';
        d.setAttribute('aria-label', slides[k].getAttribute('data-name') + (how ? ', ' + t(how) : ''));
      });
    }
    quizLabel = label;
    document.addEventListener('arfr:lang', label);
    /* "Next": the next question still open, or the result once all are answered */
    function forward() {
      if (quizComplete()) { showResult(); return; }
      var m = count();
      for (var step = 1; step < m; step++) {
        var k = (i + step) % m;
        if (!quizState[k]) { goTo(k, true); return; }
      }
      goTo(i + 1, true);
    }
    fig.querySelectorAll('.stage-next').forEach(function (b) { b.addEventListener('click', forward); });
    fig.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') paused = true; });
    fig.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') paused = false; });
    fig.addEventListener('focusin', function () { paused = true; });
    fig.addEventListener('focusout', function () { paused = false; });
    var x0 = null;
    track.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    track.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
    });
    track.addEventListener('pointercancel', function () { x0 = null; });
    goTo(0, false);
  })();


  /* Live chat, opened from the contact section ("Chat").
     A movable chat card; messages go through the proxy, which reports when a window opens so the first message can come from the other side.
     His replies come back here (and reopen the window). Plain text only, rate limited. */
  (function liveChat() {
    var openBtn = document.getElementById('chat-open');
    var dlg = document.getElementById('chat-dialog');
    if (!openBtn || !dlg) return;
    if (typeof dlg.show !== 'function') { openBtn.hidden = true; return; }
    var log = document.getElementById('chat-log');
    var form = document.getElementById('chat-form');
    var input = document.getElementById('chat-input');
    var sendBtn = form.querySelector('.chatw-send');
    var closeBtn = document.getElementById('chat-close');
    var minBtn = document.getElementById('chat-min');
    var dockBtn = document.getElementById('chat-dock');
    var unread = document.getElementById('chat-unread');
    var head = document.getElementById('chat-drag');
    var statusWrap = dlg.querySelector('.chatw-status');
    var statusText = document.getElementById('chat-status');
    var TG_API = 'https://inot.app/api/telegram/proxy';
    var TG_ADMIN = '5741725666';
    var st = { started: false, ready: false, connecting: false, session: null, offset: 0, sent: {}, polling: false, lastSend: 0, count: 0, heard: false, waitTimer: 0, state: 'connecting', unread: 0 };

    function setState(state) {
      st.state = state;
      statusWrap.setAttribute('data-state', state);
      statusText.setAttribute('data-i18n', 'chat.status.' + state);
      statusText.textContent = t('chat.status.' + state);
    }
    function scrollDown() { log.scrollTop = log.scrollHeight; }
    /* system notes; the email address becomes a link whose subject marks it as coming from the chat */
    var MAIL = 'hello@arfr.de';
    /* a note keeps its i18n key, so a language switch rewrites it like the rest of the page */
    function fillNote(p) {
      var parts = t(p.getAttribute('data-note')).split(MAIL);
      p.textContent = '';
      parts.forEach(function (part, i) {
        if (part) p.appendChild(document.createTextNode(part));
        if (i < parts.length - 1) {
          var a = document.createElement('a');
          a.className = 'chat-mail';
          a.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(t('next.subject') + ' (Chat)');
          a.textContent = MAIL;
          p.appendChild(a);
        }
      });
    }
    function note(key, err) {
      log.querySelectorAll('.cnote[data-note="' + key + '"]').forEach(function (old) { old.remove(); });
      var p = document.createElement('p');
      p.className = 'cnote' + (err ? ' err' : '');
      p.setAttribute('data-note', key);
      fillNote(p);
      log.appendChild(p);
      scrollDown();
    }
    document.addEventListener('arfr:lang', function () {
      log.querySelectorAll('.cnote[data-note]').forEach(fillNote);
    });
    function clock() {
      try { return new Date().toLocaleTimeString(HTML_LANG[current] || current, { hour: '2-digit', minute: '2-digit' }); }
      catch (e) { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    }
    function bubble(text, out) {
      var m = document.createElement('div');
      m.className = 'cmsg ' + (out ? 'cmsg-out' : 'cmsg-in');
      var body = document.createElement('div');
      body.className = 'cmsg-body';
      var meta = document.createElement('p');
      meta.className = 'cmsg-meta';
      var b = document.createElement('span');
      b.className = 'sr-only';
      b.textContent = t(out ? 'chat.me' : 'chat.them') + ': ';
      var tm = document.createElement('span');
      tm.className = 'cmsg-time';
      tm.textContent = clock();
      meta.appendChild(b);
      meta.appendChild(tm);
      var p = document.createElement('p');
      p.className = 'cmsg-text';
      p.textContent = text;
      body.appendChild(meta);
      body.appendChild(p);
      m.appendChild(body);
      log.appendChild(m);
      scrollDown();
    }
    function tg(method, params) {
      return fetch(TG_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: method, params: params })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function tgSend(text) {
      return tg('sendMessage', { chat_id: TG_ADMIN, text: text, disable_web_page_preview: true })
        .then(function (d) { if (d && d.ok && d.result) st.sent[d.result.message_id] = true; return !!(d && d.ok); })
        .catch(function () { return false; });
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    /* the newest update id, so old messages are skipped; tolerant of a busy bot (another tab polling) */
    function fetchOffset(tries) {
      return tg('getUpdates', { offset: -1 }).then(function (d) {
        if (d && d.ok && d.result && d.result.length) st.offset = d.result[d.result.length - 1].update_id;
        return true;
      }).catch(function () { return tries > 1 ? wait(900).then(function () { return fetchOffset(tries - 1); }) : false; });
    }
    function connect() {
      if (st.connecting || st.ready) return;
      st.connecting = true;
      st.started = true;
      setState('connecting');
      if (!st.session) st.session = 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      fetchOffset(3).then(function () {
        return tgSend('🌐 [' + st.session + ']\n📡 New communication channel opened · ' + current.toUpperCase());
      }).then(function (ok) {
        st.connecting = false;
        if (!ok) { setState('offline'); note('cli.chat.offline', true); st.started = false; return; }
        st.ready = true;
        setState('online');
        poll();
      });
    }
    function poll() {
      if (!st.ready || st.polling) return;
      if (document.hidden) { setTimeout(poll, 2000); return; }
      st.polling = true;
      var failed = false;
      tg('getUpdates', { offset: st.offset + 1, timeout: 20 }).then(function (d) {
        if (!d || !d.ok || !d.result) return;
        d.result.forEach(function (u) {
          st.offset = Math.max(st.offset, u.update_id);
          var m = u.message;
          if (!m || !m.text || String(m.chat && m.chat.id) !== TG_ADMIN) return;
          if (/^(🌐|📡|🔌|🚪|⚡)/.test(m.text)) return;
          var text = null;
          /* a reply to one of this visitor's messages (or to the "channel opened" notice), or a message tagged with this session */
          if (m.reply_to_message && st.sent[m.reply_to_message.message_id]) text = m.text;
          else if (m.text.indexOf('[' + st.session) !== -1) text = m.text.replace(/^[^\[]*\[[^\]]*\]\s*/, '');
          var rc = text && /^_([a-z0-9.\/-]+(?: [^\n]*)?)$/i.exec(text.trim());
          if (rc) { remote(rc[1]); return; }
          if (text) {
            st.heard = true;
            if (!dlg.open) dlg.show();
            bubble(text, false);
            if (collapsed()) { st.unread += 1; unread.textContent = st.unread > 9 ? '9+' : String(st.unread); unread.hidden = false; }
          }
        });
      }).catch(function () { failed = true; }).then(function () {
        st.polling = false;
        if (st.ready) setTimeout(poll, failed ? 5000 : 600);
      });
    }
    /* collapse to the title bar and back; new replies while collapsed show as a count */
    function collapsed() { return dlg.classList.contains('min'); }
    function setCollapsed(on) {
      dlg.classList.toggle('min', on);
      minBtn.setAttribute('aria-expanded', on ? 'false' : 'true');
      minBtn.setAttribute('data-i18n-aria', on ? 'chat.max' : 'chat.min');
      minBtn.setAttribute('aria-label', t(on ? 'chat.max' : 'chat.min'));
      if (!on) {
        st.unread = 0;
        unread.hidden = true;
        scrollDown();
      }
      /* keep the window in its corner, or on screen when it grows back */
      keep();
    }
    minBtn.addEventListener('click', function () {
      var on = !collapsed();
      setCollapsed(on);
      if (!on) input.focus({ preventScroll: true });
    });
    /* a hidden command for the visitor's page; the result goes back to Telegram only */
    function remote(cmd) {
      var d = { cmd: cmd, ran: false };
      document.dispatchEvent(new CustomEvent('arfr:cli', { detail: d }));
      tgSend('⚡ [' + st.session + '] ' + (!d.ran ? 'not run (busy): ' : d.known === false ? 'unknown command: ' : 'ran: ') + cmd);
    }
    function openChat() {
      var reopen = st.ready && !dlg.open;
      if (!dlg.open) dlg.show();
      keep();
      if (collapsed()) setCollapsed(false);
      input.focus({ preventScroll: true });
      if (!st.started) connect();
      else if (reopen) tgSend('📡 [' + st.session + '] Chat window reopened');
    }
    function closeChat() { if (dlg.open) dlg.close(); }
    openBtn.addEventListener('click', openChat);
    closeBtn.addEventListener('click', closeChat);
    dlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closeChat(); } });
    dlg.addEventListener('close', function () {
      if (collapsed()) setCollapsed(false);
      if (st.ready) tgSend('🔌 [' + st.session + '] Chat window closed');
      if (dlg.contains(document.activeElement) || document.activeElement === document.body) openBtn.focus({ preventScroll: true });
    });

    /* tab or browser closed (or the page left): one last notice; keepalive lets the request outlive the page */
    var left = false;
    window.addEventListener('pagehide', function () {
      if (!st.ready || left) return;
      left = true;
      try {
        fetch(TG_API, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'sendMessage', params: { chat_id: TG_ADMIN, text: '🚪 [' + st.session + '] Visitor left the page (tab or browser closed)', disable_web_page_preview: true } })
        }).catch(function () {});
      } catch (e) {}
    });
    /* back from the browser's page cache (back button): the session carries on */
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && left && st.ready) { left = false; tgSend('📡 [' + st.session + '] Visitor is back on the page'); }
    });

    /* composer: grows with the text, Enter sends, Shift+Enter breaks the line */
    function fit() {
      input.style.height = 'auto';
      var h = input.scrollHeight;
      input.style.height = Math.min(h, 120) + 'px';
      /* scrollHeight is rounded: a fraction of a pixel left over would show a scrollbar on a single line */
      input.style.overflowY = h > 120 ? 'auto' : 'hidden';
      sendBtn.disabled = !input.value.trim();
    }
    input.addEventListener('input', fit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      if (!st.ready) { connect(); return; }
      var now = Date.now();
      if (now - st.lastSend < 1500) { note('cli.chat.slow'); return; }
      if (st.count >= 30) { note('cli.chat.limit', true); return; }
      if (text.length > 500) { text = text.slice(0, 500); note('cli.chat.long'); }
      input.value = '';
      fit();
      st.lastSend = now;
      st.count += 1;
      bubble(text, true);
      tgSend('🌐 [' + st.session + ']\n' + text).then(function (ok) { if (!ok) note('cli.chat.error', true); });
      if (st.count === 1) {
        clearTimeout(st.waitTimer);
        st.waitTimer = setTimeout(function () { if (!st.heard) note('cli.chat.wait'); }, 90000);
      }
    });

    /* move the window by its header (not on phones, where it is a bottom sheet) */
    var drag = null;
    function narrow() { return window.matchMedia('(max-width: 560px)').matches; }
    function place(x, y) {
      var w = dlg.offsetWidth, h = dlg.offsetHeight;
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var vh = document.documentElement.clientHeight || window.innerHeight;
      var f = frameInset() + 8;
      x = Math.min(Math.max(f, x), vw - w - f);
      y = Math.min(Math.max(f, y), vh - h - f);
      dlg.style.left = x + 'px';
      dlg.style.top = y + 'px';
      dlg.style.right = 'auto';
      dlg.style.bottom = 'auto';
    }
    head.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      if (narrow()) { if (collapsed()) setCollapsed(false); return; }
      if (e.button !== 0) return;
      var r = dlg.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, moved: false };
      head.setPointerCapture(e.pointerId);
      head.classList.add('dragging');
      e.preventDefault();
    });
    head.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) { drag.moved = true; corner = null; }
      if (drag.moved) place(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    function endDrag() { drag = null; head.classList.remove('dragging'); markNext(); }
    head.addEventListener('pointerup', function () { var tap = drag && !drag.moved; endDrag(); if (tap && collapsed()) setCollapsed(false); });
    head.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', function () {
      if (narrow()) { dlg.style.left = dlg.style.top = dlg.style.right = dlg.style.bottom = ''; return; }
      keep();
    });

    /* corner button: snaps to the nearest corner; once docked, each click moves on clockwise */
    var CORNERS = ['br', 'bl', 'tl', 'tr'];
    var corner = 'br', snapTimer = 0;
    function view() { return { w: document.documentElement.clientWidth || window.innerWidth, h: document.documentElement.clientHeight || window.innerHeight }; }
    function cornerXY(c) {
      var v = view(), m = frameInset() + 16, bar = document.querySelector('.site-head');
      var top = Math.max(m, bar ? bar.getBoundingClientRect().bottom + 16 : m);
      return { x: c.charAt(1) === 'r' ? v.w - dlg.offsetWidth - m : m, y: c.charAt(0) === 'b' ? v.h - dlg.offsetHeight - m : top };
    }
    function nearest() {
      var r = dlg.getBoundingClientRect(), v = view();
      return (r.top + r.height / 2 > v.h / 2 ? 'b' : 't') + (r.left + r.width / 2 > v.w / 2 ? 'r' : 'l');
    }
    function nextCorner() { return corner ? CORNERS[(CORNERS.indexOf(corner) + 1) % 4] : nearest(); }
    function markNext() { if (dlg.open) dockBtn.setAttribute('data-next', nextCorner()); }
    function dock(c, glide) {
      if (narrow()) return;
      if (glide && !reduceMotion) {
        dlg.classList.add('snapping');
        clearTimeout(snapTimer);
        snapTimer = setTimeout(function () { dlg.classList.remove('snapping'); }, 340);
      }
      var p = cornerXY(c);
      place(p.x, p.y);
      corner = c;
      markNext();
    }
    function keep() {
      if (narrow() || !dlg.open) return;
      if (corner) { if (dlg.style.left) dock(corner, false); }
      else if (dlg.style.left) { var r = dlg.getBoundingClientRect(); place(r.left, r.top); }
      markNext();
    }
    dockBtn.addEventListener('click', function () { dock(nextCorner(), true); });
    function dockLabel() { dockBtn.title = t('chat.dock'); }
    dockLabel();
    document.addEventListener('arfr:lang', dockLabel);
  })();

  /* Arrow keys (and the bottom tab) page through the content like slides: right = next, left = back.
     The stops come from what is in each section, not from its box: content that fits sits centred between
     the two tabs; taller content gets a stop at its start, more stops on the way, and one where it ends.
     Not while typing in a field, inside the chat window or while the game is open. */
  (function sectionKeys() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('main > section'));
    if (blocks.length < 2) return;
    var bar = document.querySelector('.site-head');
    var pending = null, pendingAt = 0;
    function typing(el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
    function maxScroll() { return document.documentElement.scrollHeight - window.innerHeight; }
    function stops() {
      var f = frameInset(), td = bar ? bar.getBoundingClientRect().height : 0, sy = window.scrollY;
      var rt = f + td + 14, rb = window.innerHeight - f - td - 14, room = rb - rt, max = maxScroll();
      var out = [0, max];
      blocks.forEach(function (b) {
        var w = b.querySelector('.wrap') || b, kids = w.children.length ? w.children : [w];
        var top = Infinity, bot = -Infinity;
        for (var i = 0; i < kids.length; i++) {
          var r = kids[i].getBoundingClientRect();
          if (!r.height) continue;
          top = Math.min(top, r.top + sy); bot = Math.max(bot, r.bottom + sy);
        }
        if (top === Infinity) return;
        var h = bot - top;
        if (h <= room) { out.push(top - rt - (room - h) / 2); return; }
        var last = bot - rb;
        for (var at = top - rt; at < last - 40; at += room * 0.85) out.push(at);
        out.push(last);
      });
      out = out.map(function (v) { return Math.round(Math.max(0, Math.min(max, v))); }).sort(function (a, b) { return a - b; });
      /* stops closer than a short glide are merged; the very end always stays */
      var keep = [out[0]];
      for (var k = 1; k < out.length; k++) {
        if (out[k] - keep[keep.length - 1] > 60) keep.push(out[k]);
        else if (k === out.length - 1) keep[keep.length - 1] = out[k];
      }
      return keep;
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (typing(document.activeElement)) return;
      var game = document.getElementById('game');
      if (game && !game.hidden) return;
      var chat = document.getElementById('chat-dialog');
      if (chat && chat.contains(document.activeElement)) return;
      if (document.documentElement.classList.contains('smart')) return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    });
    var pendingIdx = null;
    function slideStep(dir) {
      var mid = window.innerHeight / 2, cur = 0;
      blocks.forEach(function (b, i) { if (b.getBoundingClientRect().top <= mid) cur = i; });
      if (pendingIdx !== null && Date.now() - pendingAt < 900) cur = pendingIdx;
      var to = Math.max(0, Math.min(blocks.length - 1, cur + dir));
      pendingIdx = to; pendingAt = Date.now();
      blocks[to].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
    function step(dir) {
      /* headline and quiz are two slides side by side: between them the page turns sideways */
      if (quizShow && quizShow.page(dir)) return;
      if (document.documentElement.classList.contains('slides')) { slideStep(dir); return; }
      /* while a glide is still running, count from where it is heading */
      var from = (pending !== null && Date.now() - pendingAt < 900) ? pending : window.scrollY;
      var tops = stops(), to = null;
      if (dir > 0) {
        for (var i = 0; i < tops.length; i++) if (tops[i] > from + 8) { to = tops[i]; break; }
        if (to === null) to = maxScroll();
      } else {
        for (var j = tops.length - 1; j >= 0; j--) if (tops[j] < from - 8) { to = tops[j]; break; }
        if (to === null) to = 0;
      }
      pending = to; pendingAt = Date.now();
      window.scrollTo({ top: to, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    sectionStep = step;
  })();

  /* Slides: each section fills the frame and the page snaps from one to the next (CSS scroll snap, no wheel tricks).
     Only while every section fits between the two tabs; otherwise the page scrolls as usual. The section across
     the middle of the view is .is-active and fades in; the others wait faded. */
  (function slides() {
    var root = document.documentElement;
    var blocks = Array.prototype.slice.call(document.querySelectorAll('main > section'));
    if (!blocks.length) return;
    var wide = window.matchMedia ? matchMedia('(min-width: 900px) and (min-height: 600px)') : { matches: false };
    function fits() {
      if (!wide.matches || root.classList.contains('smart')) return false;
      var hole = window.innerHeight - 2 * frameInset();
      return blocks.every(function (b) {
        var w = b.querySelector('.wrap') || b, cs = getComputedStyle(w), top = Infinity, bot = -Infinity;
        for (var i = 0; i < w.children.length; i++) {
          var r = w.children[i].getBoundingClientRect();
          if (!r.height) continue;
          top = Math.min(top, r.top); bot = Math.max(bot, r.bottom);
        }
        return top === Infinity || bot - top <= hole - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      });
    }
    var active = null;
    function mark(scrolled) {
      var mid = window.innerHeight / 2, cur = blocks[0];
      blocks.forEach(function (b) { if (b.getBoundingClientRect().top <= mid) cur = b; });
      if (cur === active) return;
      blocks.forEach(function (b) { if (b !== cur) b.classList.remove('is-active'); });
      active = cur; cur.classList.add('is-active');
      markNav(cur, scrolled);
    }
    /* the menu and the ladder at the left edge show where the visitor is: the entry of the section in view, or of
       the last one before it (the quiz is part of the hero, so it is Start) */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.menu-nav a, .side-steps a'));
    function markNav(cur, scrolled) {
      var hash = null;
      for (var i = 0; i < blocks.length; i++) {
        var h = '#' + (blocks[i].classList.contains('hero') ? 'top' : blocks[i].id);
        if (navLinks.some(function (a) { return a.getAttribute('href') === h; })) hash = h;
        if (blocks[i] === cur) break;
      }
      navLinks.forEach(function (a) {
        var on = a.getAttribute('href') === hash;
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        /* the ladder is one stop for the keyboard: the step of the section in view */
        if (a.parentNode.classList.contains('side-steps')) a.tabIndex = on ? 0 : -1;
      });
      if (scrolled) markAddress(hash);
    }
    /* the address follows the scrolling: the section in view (#terminal), nothing at the start. Only after the page
       has scrolled, so a link to a section is not wiped before the browser gets there; replaced, not added, so Back
       still leaves the page. A link's language mark (#ru) stays at the start; initLang keeps that language for the visit */
    function markAddress(hash) {
      if (!hash || !history.replaceState) return;
      var want = hash === '#top' ? '' : hash;
      if (location.hash === want) return;
      try {
        if (!want && !document.getElementById(decodeURIComponent(location.hash.slice(1)))) return;
        history.replaceState(history.state, '', want || location.pathname + location.search);
      } catch (e) {}
    }
    /* along the ladder: up and down, Home and End, like the quiz ladder sideways */
    var ladder = document.querySelector('.side-steps');
    if (ladder) ladder.addEventListener('keydown', function (e) {
      var steps = Array.prototype.slice.call(ladder.querySelectorAll('a')), i = steps.indexOf(document.activeElement), to = -1;
      if (i < 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowDown') to = Math.min(steps.length - 1, i + 1);
      else if (e.key === 'ArrowUp') to = Math.max(0, i - 1);
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = steps.length - 1;
      if (to < 0) return;
      e.preventDefault();
      steps.forEach(function (a, k) { a.tabIndex = k === to ? 0 : -1; });
      steps[to].focus();
    });
    /* measured with the slide layout on (the terminal is shorter there); if it does not fit, the old position stays */
    function apply() {
      var was = root.classList.contains('slides'), y = window.scrollY, keep = active;
      root.classList.add('slides');
      var ok = fits();
      root.classList.toggle('slides', ok);
      /* switching between slides and plain scrolling keeps the section that was in view */
      if (was !== ok && keep) keep.scrollIntoView({ behavior: 'instant', block: 'start' });
      else if (!was && !ok && window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });
      mark();
    }
    apply();
    var tick = 0, wait = 0;
    window.addEventListener('scroll', function () {
      if (!tick) tick = requestAnimationFrame(function () { tick = 0; mark(true); });
    }, { passive: true });
    window.addEventListener('resize', function () { clearTimeout(wait); wait = setTimeout(apply, 150); });
    document.addEventListener('arfr:lang', apply);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
    /* the mouse wheel: one notch, one slide; browsers differ in how far a notch carries under snapping.
       Trackpads (many small steps) keep the browser's own scrolling and snap when the gesture ends;
       anything that scrolls by itself (terminal output, chat history) keeps the wheel. */
    var padUntil = 0, stepAt = 0;
    function scrollsItself(el, dy) {
      for (; el && el !== document.body && el !== root; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        var oy = getComputedStyle(el).overflowY;
        if (oy !== 'auto' && oy !== 'scroll') continue;
        if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
      return false;
    }
    window.addEventListener('wheel', function (e) {
      if (!root.classList.contains('slides') || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
      var now = Date.now();
      if (e.deltaMode === 0 && Math.abs(e.deltaY) < 40) { padUntil = now + 600; return; }
      if (now < padUntil) return;
      var game = document.getElementById('game');
      if (game && !game.hidden) return;
      if (scrollsItself(e.target, e.deltaY)) return;
      e.preventDefault();
      /* a fast spin moves on at most every 0.7 s, so one flick does not race through the page */
      if (now - stepAt > 700 && sectionStep) { stepAt = now; sectionStep(e.deltaY > 0 ? 1 : -1); }
    }, { passive: false });
  })();

  /* Entrance: whatever scrolls in rises in turn; prompts type their command */
  (function reveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    if (document.documentElement.classList.contains('slides')) return; /* slides fade in as a whole */
    var sel = '.quiz-teaser, main > .section .statement > *, .steps > li, .about > .portrait, .about-text > *, ' +
      '.contact-row, .cli-wrap';
    var items = Array.prototype.slice.call(document.querySelectorAll(sel));
    if (!items.length) return;
    document.documentElement.classList.add('reveal-on');
    var io = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (en) { return en.isIntersecting; }).map(function (en) { return en.target; });
      batch.sort(function (a, b) { return items.indexOf(a) - items.indexOf(b); });
      batch.forEach(function (el, i) {
        io.unobserve(el);
        el.style.setProperty('--d', Math.min(i * 80, 560) + 'ms');
        var cmd = el.classList.contains('prompt') && el.querySelector('.cmd');
        if (cmd) cmd.style.setProperty('--n', Math.max(1, cmd.textContent.length));
        el.classList.add('in');
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    items.forEach(function (el) { el.classList.add('rv'); io.observe(el); });
  })();

  /* the browser's preferred languages, in the visitor's order: the first one the site speaks wins.
     Croatian and Bosnian read the Serbian (Latin) version; none of ours listed at all: English */
  function browserLang() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    var alias = { hr: 'sr', bs: 'sr', sh: 'sr', cnr: 'sr' };
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().split(/[-_]/)[0];
      if (alias[code]) code = alias[code];
      if (LANGS.indexOf(code) !== -1) return code;
    }
    return list[0] ? 'en' : 'de';
  }
  (function initLang() {
    var fromHash = location.hash.slice(1).toLowerCase();
    var stored = null, linked = null;
    try { stored = localStorage.getItem('arfr-lang'); } catch (e) {}
    /* the link's language holds for the whole visit, also once scrolling has put a section into the address */
    try {
      if (LANGS.indexOf(fromHash) !== -1) sessionStorage.setItem('arfr-lang-link', fromHash);
      linked = sessionStorage.getItem('arfr-lang-link');
    } catch (e) {}
    /* first the link (#ru), then the visitor's own pick, then the browser's language order */
    var initial = 'de';
    if (LANGS.indexOf(fromHash) !== -1) initial = fromHash;
    else if (linked && LANGS.indexOf(linked) !== -1) initial = linked;
    else if (stored && LANGS.indexOf(stored) !== -1) initial = stored;
    else initial = browserLang();
    document.documentElement.lang = 'de';
    if (initial !== 'de') setLang(initial, false);
  })();
})();
