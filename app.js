function parseYouTubeId(raw){
  try{
    const u = new URL(raw);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if(u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  }catch(e){ }
  return null;
}

function youtubeEmbedUrl(id, opts = {}){
  const defaults = {autoplay:0, mute:0, controls:1, rel:0, modestbranding:1};
  const params = new URLSearchParams(Object.assign(defaults, opts));
  // If loop requested, YouTube requires loop=1 and playlist=<video_id>
  if(opts && (opts.loop === 1 || opts.loop === true)){
    params.set('loop', '1');
    params.set('playlist', id);
  }
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function makeThumb(v, index){
  const div = document.createElement('div');
  div.className = 'thumb';
  const img = document.createElement('img');
  img.src = v.thumbnail || 'https://via.placeholder.com/480x270?text=Video';
  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = v.title || 'Video';
  div.appendChild(img);
  div.appendChild(info);
  div.addEventListener('click', ()=>{
    document.getElementById('btn-shorts').click();
    const target = document.getElementById('shorts-list').children[index];
    if(target) target.scrollIntoView({behavior:'smooth'});
  });
  return div;
}

function makeShortItem(v, index){
  const item = document.createElement('div');
  item.className = 'short-item';
  const wrap = document.createElement('div');
  wrap.className = 'media-wrap';

  if(v.type === 'youtube'){
    const id = parseYouTubeId(v.url);
    const iframe = document.createElement('iframe');
    const mutedSrc = youtubeEmbedUrl(id, {autoplay:1, mute:1, controls:0, playsinline:1, loop:1});
    const unmutedSrc = youtubeEmbedUrl(id, {autoplay:1, mute:0, controls:0, playsinline:1, loop:1});
    iframe.dataset.srcMuted = mutedSrc;
    iframe.dataset.srcUnmuted = unmutedSrc;
    iframe.dataset.src = mutedSrc;
    // allow autoplay and related features
    iframe.allow = 'autoplay; encrypted-media; clipboard-write; picture-in-picture; accelerometer; gyroscope';
    iframe.allowFullscreen = true;
    wrap.appendChild(iframe);
  } else if(v.type === 'mp4'){
    const vid = document.createElement('video');
    vid.src = v.url;
    vid.muted = true;
    vid.playsInline = true;
    vid.loop = true;
    vid.controls = false;
    wrap.appendChild(vid);
  } else {
    const a = document.createElement('a');
    a.href = v.url;
    a.textContent = v.title || 'Ouvrir';
    a.target = '_blank';
    wrap.appendChild(a);
  }

  const overlay = document.createElement('div');
  overlay.className = 'short-overlay';
  const title = document.createElement('div');
  title.textContent = v.title || '';
  title.style.fontWeight = '700';
  const author = document.createElement('div');
  author.textContent = v.author || '';
  author.style.opacity = '0.85';
  overlay.appendChild(title);
  overlay.appendChild(author);

  const open = document.createElement('a');
  open.className = 'open';
  open.href = v.url;
  open.target = '_blank';
  open.textContent = 'Ouvrir';
  open.style.position = 'absolute';
  open.style.right = '16px';
  open.style.bottom = '28px';

  item.appendChild(wrap);
  item.appendChild(overlay);
  item.appendChild(open);
  return item;
}

function setupShortsObserver(){
  const list = document.getElementById('shorts-list');
  const options = { root: list, threshold: 0.6 };
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const el = entry.target;
      const iframe = el.querySelector('iframe');
      const video = el.querySelector('video');
      if(entry.isIntersecting){
        el.classList.add('active');
        // restart behavior: reload iframe src to restart YouTube, reset time for video
        if(iframe){
          // choose muted or unmuted source based on global state
          if(typeof isMuted !== 'undefined'){
            iframe.src = isMuted ? (iframe.dataset.srcMuted || iframe.dataset.src) : (iframe.dataset.srcUnmuted || iframe.dataset.src);
          } else {
            iframe.src = iframe.dataset.src;
          }
        }
        if(video){ try{ video.currentTime = 0; }catch(e){}; video.play().catch(()=>{}); }
      } else {
        el.classList.remove('active');
        // unload iframe to ensure restart on next enter
        if(iframe && iframe.src){ iframe.src = ''; }
        if(video){ video.pause(); }
      }
    });
  }, options);

  Array.from(list.children).forEach(child=> obs.observe(child));
}

function switchView(view){
  document.querySelectorAll('.view').forEach(v=> v.classList.add('hidden'));
  document.getElementById(view).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=> b.classList.remove('active'));
  document.getElementById('btn-'+view).classList.add('active');
  const nav = document.querySelector('.short-nav');
  if(nav) nav.setAttribute('aria-hidden', view !== 'shorts');
}

fetch('/api/videos').then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(data=>{
    const thumbs = document.getElementById('list');
    const shorts = document.getElementById('shorts-list');
    (data.videos||[]).forEach((v,i)=>{
      thumbs.appendChild(makeThumb(v,i));
      shorts.appendChild(makeShortItem(v,i));
    });
    setupShortsObserver();
  }).catch(err=>{
    const list = document.getElementById('list');
    list.textContent = 'Erreur: impossible de charger les vidéos.';
    console.error(err);
  });

document.getElementById('btn-home').addEventListener('click', ()=> switchView('home'));
document.getElementById('btn-shorts').addEventListener('click', ()=> switchView('shorts'));

// CTA handlers on homepage
const ctaShorts = document.getElementById('cta-shorts');
if(ctaShorts) ctaShorts.addEventListener('click', ()=> { switchView('shorts'); document.getElementById('shorts-list').scrollTo({top:0, behavior:'smooth'}); });
const ctaBrowse = document.getElementById('cta-browse');
if(ctaBrowse) ctaBrowse.addEventListener('click', ()=> { document.getElementById('btn-home').click(); window.scrollTo({top: document.getElementById('list').offsetTop, behavior:'smooth'}); });

// Theme switcher
function setTheme(theme){
  if(theme === 'default'){
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  document.querySelectorAll('.theme-btn').forEach(b=> b.classList.toggle('active', b.dataset.theme === theme));
}

document.querySelectorAll('.theme-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> setTheme(btn.dataset.theme));
});
// initialize default
setTheme('default');

// Short navigation: prev / next
function getActiveIndex(){
  const list = document.getElementById('shorts-list');
  const items = Array.from(list.children);
  const active = items.findIndex(it => it.classList.contains('active'));
  if(active >= 0) return active;
  // fallback: find item nearest to center of the list viewport
  const listRect = list.getBoundingClientRect();
  const rects = items.map(it => it.getBoundingClientRect());
  const centerY = listRect.top + listRect.height / 2;
  let best = 0, bestDist = Infinity;
  rects.forEach((r,i)=>{
    const itemCenter = (r.top + r.bottom) / 2;
    const dist = Math.abs(itemCenter - centerY);
    if(dist < bestDist){ bestDist = dist; best = i; }
  });
  return best;
}

function scrollToIndex(i){
  const list = document.getElementById('shorts-list');
  const items = Array.from(list.children);
  if(i < 0 || i >= items.length) return;
  // Scroll the shorts container so the target item appears at top of the container
  const top = items[i].offsetTop;
  list.scrollTo({ top, behavior: 'smooth' });
}

document.getElementById('short-up').addEventListener('click', ()=>{
  const idx = getActiveIndex();
  scrollToIndex(Math.max(0, idx - 1));
});
document.getElementById('short-down').addEventListener('click', ()=>{
  const idx = getActiveIndex();
  const list = document.getElementById('shorts-list');
  scrollToIndex(Math.min(list.children.length - 1, idx + 1));
});

// Sound toggle
let isMuted = false;
function setMuted(muted){
  isMuted = !!muted;
  const btn = document.getElementById('sound-toggle');
  if(btn){
    btn.classList.toggle('sound-on', !isMuted);
    btn.textContent = isMuted ? '🔈' : '🔊';
  }
  // apply to current active item
  const idx = getActiveIndex();
  const list = document.getElementById('shorts-list');
  const items = Array.from(list.children);
  const el = items[idx];
  if(!el) return;
  const iframe = el.querySelector('iframe');
  const video = el.querySelector('video');
  if(iframe){
    // reload iframe with the correct muted/unmuted src (reload will restart)
    const muted = iframe.dataset.srcMuted;
    const unmuted = iframe.dataset.srcUnmuted;
    if(unmuted && muted){
      iframe.src = isMuted ? muted : unmuted;
    } else {
      const src = iframe.dataset.src || '';
      iframe.src = isMuted ? src : src.replace('mute=1','mute=0');
    }
  }
  if(video){
    try{ video.muted = isMuted; if(!isMuted){ video.currentTime = 0; video.play().catch(()=>{}); } }
    catch(e){}
  }
}

const soundBtn = document.getElementById('sound-toggle');
if(soundBtn) soundBtn.addEventListener('click', ()=> setMuted(!isMuted));
// initialize (default: sound on)
setMuted(false);

