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

  /* ---------- shared corporate inquiry / Torutsugu lead form ---------- */
  var form = document.getElementById('vdForm');
  if(form){
    var stat=document.getElementById('fstat'), fbtn=document.getElementById('fbtn'),
        wrap=document.getElementById('fwrap'), topic=document.getElementById('f-topic'),
        intro=document.getElementById('locueRequestIntro'),
        purposeWrap=document.getElementById('f-purpose-wrap'),
        subject=document.getElementById('f-subject'),
        source=document.getElementById('f-source');
    var REQ=[['f-company',S.f1],['f-name',S.f2],['f-email',S.f3]];
    var params=new URLSearchParams(window.location.search);
    var referred=params.get('request')==='torutsugu'||params.get('request')==='locue';
    if(referred && topic)topic.value='トルツグ 資料請求';

    function updateContext(){
      var torutsugu=topic && topic.value==='トルツグ 資料請求';
      if(intro)intro.hidden=!torutsugu;
      if(purposeWrap)purposeWrap.hidden=!torutsugu;
      form.classList.toggle('locue-request',!!torutsugu);
      var radios=form.querySelectorAll('input[name="purpose"]');
      [].forEach.call(radios,function(radio){radio.required=!!torutsugu;radio.disabled=!torutsugu;});
      var selected=form.querySelector('input[name="purpose"]:checked');
      if(subject){
        subject.value=torutsugu?'トルツグ お問い合わせ｜'+(selected?selected.value:'目的未選択'):
          'Vitality Design お問い合わせ｜'+(topic&&topic.value?topic.value:'その他');
      }
      if(source)source.value=referred?'トルツグ サービスサイト':'コーポレートサイト';
      var label=torutsugu?(selected&&selected.value==='情報収集'?'サービス資料を請求する':
        selected&&selected.value==='打ち合わせ希望'?'打ち合わせを依頼する':
        selected&&selected.value==='導入検討・有償PoC相談'?'導入・PoCについて相談する':
        'お問い合わせを送る'):'お問い合わせを送る';
      S.submit=label;
      if(fbtn&&!fbtn.disabled)fbtn.textContent=label;
      if(stat)stat.textContent='';
    }
    if(topic)topic.addEventListener('change',updateContext);
    [].forEach.call(form.querySelectorAll('input[name="purpose"]'),function(radio){
      radio.addEventListener('change',updateContext);
    });
    updateContext();

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var missing=[],el;
      for(var i=0;i<REQ.length;i++){
        el=document.getElementById(REQ[i][0]);
        if(!el||!el.value.trim())missing.push(REQ[i][1]);
      }
      if(missing.length){
        stat.textContent=S.eReq+missing.join(S.sep);
        for(var k=0;k<REQ.length;k++){
          var first=document.getElementById(REQ[k][0]);
          if(first&&!first.value.trim()){first.focus();break;}
        }
        return;
      }
      if(!topic||!topic.value){
        stat.textContent='お問い合わせの種類を選択してください。';
        if(topic)topic.focus();
        return;
      }
      if(form.classList.contains('locue-request')&&!form.querySelector('input[name="purpose"]:checked')){
        stat.textContent='お問い合わせの目的を選択してください。';
        var firstPurpose=document.getElementById('f-purpose-info');
        if(firstPurpose)firstPurpose.focus();
        return;
      }
      var mail=document.getElementById('f-email').value.trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){
        stat.textContent=S.eMail;document.getElementById('f-email').focus();return;
      }
      stat.textContent='';fbtn.disabled=true;fbtn.textContent=S.sending;
      fetch(form.action,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}})
      .then(function(r){
        if(r.ok){
          wrap.classList.add('sent');
          if(window.gtag)gtag('event','generate_lead',{method:'contact_form',lead_type:topic.value});
        }else{
          stat.textContent=S.eSend;fbtn.disabled=false;fbtn.textContent=S.submit;
        }
      })
      .catch(function(){
        stat.textContent=S.eSend;fbtn.disabled=false;fbtn.textContent=S.submit;
      });
    });
  }

  /* ---------- 相談種別のプリフィル ---------- */
  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-topic]');
    if(!a) return;
    var sel = document.getElementById('f-topic');
    if(!sel) return;
    var want = a.getAttribute('data-topic');
    for(var i = 0; i < sel.options.length; i++){
      if(sel.options[i].value === want || sel.options[i].text === want){ sel.selectedIndex = i; break; }
    }
  });

  /* ---------- cta tracking ---------- */
  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-cta]');
    if(a && window.gtag) gtag('event','cta_click',{cta:a.getAttribute('data-cta')});
  });
})();