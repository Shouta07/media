(function(){'use strict';var S=(window.VD_S||{});
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal ---------- */
  var targets = [].slice.call(document.querySelectorAll('.r,.ln'));
  [].forEach.call(document.querySelectorAll('[data-stagger]'), function(g){
    [].slice.call(g.querySelectorAll('.r-s')).forEach(function(n,i){ n.style.setProperty('--i', i); targets.push(n); });
  });
  if(RM || !('IntersectionObserver' in window)){
    targets.forEach(function(n){ n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {rootMargin:'0px 0px -9% 0px', threshold:0.06});
    targets.forEach(function(n){ io.observe(n); });
    var hero = document.querySelector('.hero');
    if(hero) requestAnimationFrame(function(){
      [].forEach.call(hero.querySelectorAll('.r,.ln'), function(n){ n.classList.add('in'); });
    });
  }

  /* ---------- mobile panel ---------- */
  var burger = document.getElementById('burger'), panel = document.getElementById('panel');
  function setPanel(open){
    panel.setAttribute('data-open', open ? 'true' : 'false');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? S.menuC : S.menuO);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if(burger && panel){
    burger.addEventListener('click', function(){ setPanel(panel.getAttribute('data-open') !== 'true'); });
    panel.addEventListener('click', function(e){ if(e.target.closest('a')) setPanel(false); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') setPanel(false); });
  }

  /* ---------- showcase ---------- */
  var CONCEPTS = {
    a: { k:S.c.a.k, t:S.c.a.t, d:S.c.a.d, hot:S.c.a.h },
    b: { k:S.c.b.k, t:S.c.b.t, d:S.c.b.d, hot:S.c.b.h }
  };
  var STATES = [
    {s:'before', label:S.st[0],       meta:S.sm[0],       pos:0},
    {s:'live',   label:S.st[1],       meta:S.sm[1],       pos:50},
    {s:'after',  label:S.st[2], meta:S.sm[2], pos:100}
  ];
  var art = document.getElementById('art'), fill = document.getElementById('fill'),
      dot = document.getElementById('dot'), meta = document.getElementById('meta'),
      capK = document.getElementById('cap-k'), capT = document.getElementById('cap-t'),
      capD = document.getElementById('cap-d'), hotEl = document.getElementById('hot'),
      playT = document.getElementById('play-t'), stage = document.getElementById('stage');
  var curC = 'a', curS = 1, timer = null;

  function paintState(){
    var st = STATES[curS];
    if(art) art.setAttribute('data-state', st.s);
    if(fill) fill.style.width = st.pos + '%';
    if(dot) dot.style.left = st.pos + '%';
    if(meta) meta.textContent = st.meta;
    [].forEach.call(document.querySelectorAll('.stops button'), function(b){
      b.setAttribute('aria-current', b.getAttribute('data-s') === st.s ? 'true' : 'false');
    });
    [].forEach.call(document.querySelectorAll('.seg button'), function(b){
      var on = (b.getAttribute('data-s') === 'before') ? (st.s === 'before') : (st.s !== 'before');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function paintConcept(){
    var c = CONCEPTS[curC];
    if(capK) capK.textContent = c.k;
    if(capT) capT.textContent = c.t;
    if(capD) capD.textContent = c.d;
    if(hotEl) hotEl.innerHTML = '<b>＋</b>' + c.hot;
    [].forEach.call(document.querySelectorAll('.tab'), function(b){
      var on = b.getAttribute('data-c') === curC;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if(on && stage) stage.setAttribute('aria-labelledby', b.id);
    });
  }
  function stopPlay(){
    if(timer){ clearInterval(timer); timer = null; }
    if(playT) playT.textContent = S.play;
  }
  [].forEach.call(document.querySelectorAll('.tab'), function(b){
    b.addEventListener('click', function(){ curC = b.getAttribute('data-c'); paintConcept(); });
  });
  [].forEach.call(document.querySelectorAll('.stops button,.seg button'), function(b){
    b.addEventListener('click', function(){
      var s = b.getAttribute('data-s');
      for(var i = 0; i < STATES.length; i++){ if(STATES[i].s === s){ curS = i; break; } }
      stopPlay(); paintState();
    });
  });
  var play = document.getElementById('play');
  if(play) play.addEventListener('click', function(){
    if(timer){ stopPlay(); return; }
    if(RM){ curS = 1; paintState(); return; }
    curS = 0; paintState();
    if(playT) playT.textContent = S.stop;
    timer = setInterval(function(){
      curS++;
      if(curS >= STATES.length){ curS = STATES.length - 1; paintState(); stopPlay(); return; }
      paintState();
    }, 2200);
  });
  paintConcept(); paintState();

  /* ---------- accordions ---------- */
  [].forEach.call(document.querySelectorAll('#layerlist li, #steplist li'), function(li){
    var btn = li.querySelector('button');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var open = li.getAttribute('data-open') === 'true';
      var sibs = li.parentNode.children;
      [].forEach.call(sibs, function(s){
        s.setAttribute('data-open', 'false');
        var b = s.querySelector('button'); if(b) b.setAttribute('aria-expanded', 'false');
      });
      if(!open){ li.setAttribute('data-open', 'true'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ---------- form ---------- */
  var form = document.getElementById('vdForm');
  if(form){
    var stat = document.getElementById('fstat'), fbtn = document.getElementById('fbtn'),
        wrap = document.getElementById('fwrap');
    var REQ = [['f-company',S.f1],['f-name',S.f2],['f-email',S.f3]];
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var missing = [], el;
      for(var i = 0; i < REQ.length; i++){
        el = document.getElementById(REQ[i][0]);
        if(!el || !el.value.trim()) missing.push(REQ[i][1]);
      }
      if(missing.length){ stat.textContent = S.eReq + missing.join(S.sep); return; }
      var mail = document.getElementById('f-email').value.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){
        stat.textContent = S.eMail; return;
      }
      stat.textContent = ''; fbtn.disabled = true; fbtn.textContent = S.sending;
      fetch(form.action, { method:'POST', body:new FormData(form), headers:{'Accept':'application/json'} })
        .then(function(r){
          if(r.ok){
            wrap.classList.add('sent');
            if(window.gtag) gtag('event','generate_lead',{method:'contact_form'});
          } else {
            stat.textContent = S.eSend;
            fbtn.disabled = false; fbtn.textContent = S.submit;
          }
        })
        .catch(function(){
          stat.textContent = S.eSend;
          fbtn.disabled = false; fbtn.textContent = S.submit;
        });
    });
  }

  /* ---------- cta tracking ---------- */
  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-cta]');
    if(a && window.gtag) gtag('event','cta_click',{cta:a.getAttribute('data-cta')});
  });
})();