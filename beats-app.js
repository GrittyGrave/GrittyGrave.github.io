/* ============================================================
   GRITTY GRAVE — BEATS PORTFOLIO
   ============================================================ */
document.getElementById('logoImg').src = LOGO_DATA;

const ADMIN_PASSWORD = 'grittygrave';   // change anytime

let beats = [];
let isAdmin = false;
let editingId = null;
let activeFilter = 'all';

/* ============================================================
   STORAGE (Claude artifact -> window.storage; website -> localStorage)
   ============================================================ */
const GG = {
  hasClaude: (typeof window !== 'undefined' && window.storage),
  async get(key){
    if(this.hasClaude){
      try{ const r = await window.storage.get(key, true); return r ? r.value : null; }
      catch(e){ return null; }
    }
    return localStorage.getItem(key);
  },
  async set(key, value){
    if(this.hasClaude){
      try{ await window.storage.set(key, value, true); return; }
      catch(e){ /* fall through */ }
    }
    try{ localStorage.setItem(key, value); }catch(e){ console.warn('storage failed', e); }
  }
};
async function loadBeats(){
  try{
    const v = await GG.get('gg-beats');
    if(v){ beats = JSON.parse(v); }
  }catch(e){ beats = []; }
}
async function saveBeats(){
  try{ await GG.set('gg-beats', JSON.stringify(beats)); }
  catch(e){ console.warn('save failed', e); }
}

/* ============================================================
   EMBED PARSING — turn a share link into an iframe
   ============================================================ */
function buildEmbed(url){
  if(!url) return null;
  const u = url.trim();

  // YouTube
  let yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if(yt){
    return `<iframe height="170" src="https://www.youtube.com/embed/${yt[1]}" `+
           `allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" `+
           `allowfullscreen loading="lazy"></iframe>`;
  }
  // SoundCloud
  if(/soundcloud\.com/.test(u)){
    return `<iframe height="166" loading="lazy" `+
           `src="https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}`+
           `&color=%23a9d92e&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false"></iframe>`;
  }
  // BeatStars
  if(/beatstars\.com/.test(u)){
    // beatstars share links — embed via their player path when possible
    return `<iframe height="170" loading="lazy" src="${escapeAttr(u)}" `+
           `style="background:#11150a"></iframe>`;
  }
  // Spotify (bonus, harmless)
  let sp = u.match(/spotify\.com\/(track|album|playlist)\/([\w]+)/);
  if(sp){
    return `<iframe height="152" loading="lazy" `+
           `src="https://open.spotify.com/embed/${sp[1]}/${sp[2]}"></iframe>`;
  }
  return null;  // unknown — show fallback
}

/* ============================================================
   RENDER GRID
   ============================================================ */
function renderFilters(){
  const moods = [...new Set(beats.map(b=>b.mood).filter(Boolean))];
  const bar = document.getElementById('filterBar');
  if(!beats.length){ bar.innerHTML = ''; return; }
  bar.innerHTML = '';
  const mk = (val,label)=>{
    const b = document.createElement('button');
    b.className = 'fchip' + (activeFilter===val ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', ()=>{ activeFilter = val; renderFilters(); renderGrid(); });
    return b;
  };
  bar.appendChild(mk('all','All Beats'));
  moods.forEach(m=> bar.appendChild(mk(m,m)));
}

function renderGrid(){
  const grid = document.getElementById('beatGrid');
  const holder = document.getElementById('emptyHolder');
  grid.innerHTML = '';
  holder.innerHTML = '';

  if(!beats.length){
    holder.innerHTML = `
      <div class="empty-state">
        <div class="es-skull">\uD83D\uDC80</div>
        <div class="es-title">No Beats In The Grave Yet</div>
        <div class="es-sub">Beats will show up here once they're added. Check back soon — or hit the Beat Challenge page and tell me what to make.</div>
      </div>`;
    document.getElementById('countLine').textContent = '';
    return;
  }

  const shown = beats.filter(b=> activeFilter==='all' || b.mood===activeFilter);
  document.getElementById('countLine').textContent =
    shown.length + (shown.length===1 ? ' beat' : ' beats');

  shown.forEach(b=>{
    const card = document.createElement('div');
    card.className = 'beat-card';
    const embed = buildEmbed(b.embed);
    const playerHtml = embed
      ? embed
      : `<div class="no-embed">Player link not recognized<br>${escapeHtml(b.embed||'')}</div>`;

    let pills = '';
    if(b.bpm)  pills += `<span class="bc-pill">${escapeHtml(b.bpm)} BPM</span>`;
    if(b.key)  pills += `<span class="bc-pill">${escapeHtml(b.key)}</span>`;
    if(b.mood) pills += `<span class="bc-pill mood">${escapeHtml(b.mood)}</span>`;

    const tiktok = b.tiktok
      ? `<a class="bc-tiktok" href="${escapeAttr(b.tiktok)}" target="_blank" rel="noopener">▶ Watch It Made On TikTok</a>`
      : '';

    const adminRow = isAdmin
      ? `<div class="bc-admin-row">
           <button class="edit" data-edit="${b.id}">Edit</button>
           <button class="del" data-del="${b.id}">Delete</button>
         </div>`
      : '';

    card.innerHTML = `
      <div class="bc-player">${playerHtml}</div>
      <div class="bc-info">
        <div class="bc-title">${escapeHtml(b.title||'Untitled')}</div>
        <div class="bc-meta">${pills}</div>
        ${tiktok}
        ${adminRow}
      </div>`;
    grid.appendChild(card);
  });

  // wire admin buttons
  grid.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=> startEdit(btn.dataset.edit));
  });
  grid.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteBeat(btn.dataset.del));
  });
}

/* ============================================================
   ESCAPING
   ============================================================ */
function escapeHtml(str){
  return String(str).replace(/[&<>"]/g, m=>(
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/'/g,'&#39;'); }

/* ============================================================
   ADMIN
   ============================================================ */
const adminModal = document.getElementById('adminModal');
document.getElementById('adminOpen').addEventListener('click', ()=>{
  adminModal.classList.add('show');
  if(isAdmin){ showDash(); } else { showLogin(); }
});
document.getElementById('adminClose').addEventListener('click', ()=> adminModal.classList.remove('show'));
adminModal.addEventListener('click', e=>{ if(e.target===adminModal) adminModal.classList.remove('show'); });

function showLogin(){
  document.getElementById('loginView').style.display = '';
  document.getElementById('dashView').style.display = 'none';
  document.getElementById('adminTitle').textContent = 'Admin Login';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('pwIn').value = '';
}
function showDash(){
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashView').style.display = '';
  document.getElementById('adminTitle').textContent = 'Manage Beats';
  resetForm();
  renderAdminList();
}
document.getElementById('loginBtn').addEventListener('click', tryLogin);
document.getElementById('pwIn').addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
function tryLogin(){
  if(document.getElementById('pwIn').value === ADMIN_PASSWORD){
    isAdmin = true;
    showDash();
    renderGrid();   // re-render so edit/delete buttons appear
  }else{
    document.getElementById('loginErr').textContent = 'Wrong password.';
  }
}

/* ---- add / edit form ---- */
function resetForm(){
  editingId = null;
  document.getElementById('formMode').textContent = 'Add A Beat';
  document.getElementById('saveBeatBtn').textContent = 'Save Beat';
  ['bTitle','bBpm','bKey','bMood','bEmbed','bTiktok'].forEach(id=>{
    document.getElementById(id).value = '';
  });
  document.getElementById('formErr').textContent = '';
}
function startEdit(id){
  const b = beats.find(x=>x.id===id);
  if(!b) return;
  editingId = id;
  document.getElementById('formMode').textContent = 'Edit Beat';
  document.getElementById('saveBeatBtn').textContent = 'Update Beat';
  document.getElementById('bTitle').value  = b.title || '';
  document.getElementById('bBpm').value    = b.bpm || '';
  document.getElementById('bKey').value    = b.key || '';
  document.getElementById('bMood').value   = b.mood || '';
  document.getElementById('bEmbed').value  = b.embed || '';
  document.getElementById('bTiktok').value = b.tiktok || '';
  adminModal.classList.add('show');
  showDash();
  document.getElementById('formMode').textContent = 'Edit Beat';
  document.getElementById('saveBeatBtn').textContent = 'Update Beat';
  document.getElementById('bTitle').value  = b.title || '';
  document.getElementById('bBpm').value    = b.bpm || '';
  document.getElementById('bKey').value    = b.key || '';
  document.getElementById('bMood').value   = b.mood || '';
  document.getElementById('bEmbed').value  = b.embed || '';
  document.getElementById('bTiktok').value = b.tiktok || '';
  editingId = id;
}
document.getElementById('saveBeatBtn').addEventListener('click', saveBeat);
async function saveBeat(){
  const title  = document.getElementById('bTitle').value.trim();
  const bpm    = document.getElementById('bBpm').value.trim();
  const key    = document.getElementById('bKey').value.trim();
  const mood   = document.getElementById('bMood').value.trim();
  const embed  = document.getElementById('bEmbed').value.trim();
  const tiktok = document.getElementById('bTiktok').value.trim();
  const err = document.getElementById('formErr');
  err.textContent = '';

  if(!title){ err.textContent = 'Give the beat a title.'; return; }
  if(!embed){ err.textContent = 'Add an embed link so it can play.'; return; }

  if(editingId){
    const b = beats.find(x=>x.id===editingId);
    if(b){ Object.assign(b,{title,bpm,key,mood,embed,tiktok}); }
    toast('Beat updated');
  }else{
    beats.unshift({ id:'beat_'+Date.now(), title,bpm,key,mood,embed,tiktok });
    toast('Beat added');
  }
  await saveBeats();
  resetForm();
  renderAdminList();
  renderFilters();
  renderGrid();
}
async function deleteBeat(id){
  if(!confirm('Delete this beat?')) return;
  beats = beats.filter(x=>x.id!==id);
  await saveBeats();
  renderAdminList();
  renderFilters();
  renderGrid();
  toast('Beat deleted');
}
function renderAdminList(){
  const c = document.getElementById('adminBeatList');
  if(!beats.length){
    c.innerHTML = '<div style="color:var(--muted-2);font-size:12px;font-family:Space Mono,monospace;">No beats yet — add your first above.</div>';
    return;
  }
  c.innerHTML = '';
  beats.forEach(b=>{
    const row = document.createElement('div');
    row.className = 'abl-item';
    row.innerHTML = `
      <span class="abl-name">${escapeHtml(b.title)}</span>
      <span class="abl-meta">${escapeHtml(b.bpm||'')}${b.bpm?' BPM':''}</span>
      <button class="mini-btn" data-aedit="${b.id}" style="font-size:10px;padding:0 9px;">Edit</button>
      <button class="mini-btn" data-adel="${b.id}" style="font-size:10px;padding:0 9px;background:var(--panel-2);color:var(--blood-bright);border-color:var(--blood);">Del</button>`;
    row.querySelector('[data-aedit]').addEventListener('click', ()=> startEdit(b.id));
    row.querySelector('[data-adel]').addEventListener('click', ()=> deleteBeat(b.id));
    c.appendChild(row);
  });
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function toast(msg, bad){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className = 'toast' + (bad ? ' bad' : ''); }, 1700);
}

/* ============================================================
   INIT
   ============================================================ */
(async function init(){
  await loadBeats();
  renderFilters();
  renderGrid();
})();
