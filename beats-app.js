/* ============================================================
   GRITTY GRAVE — BEATS PORTFOLIO  
   ============================================================ */

const SUPABASE_URL = 'https://gkglkyrnbgzjudjgqtye.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZ2xreXJuYmd6anVkamdxdHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDAxNTIsImV4cCI6MjA5NTMxNjE1Mn0.Qmz3ni55c8evWaPjIEONeNiicQnqojBES-LlHOZafOo';

/* ---- Supabase helpers ---- */
const SB = {
  async req(method, path, body){
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method,
      headers:{
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : ''
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if(!res.ok){ console.error('SB error', await res.text()); return null; }
    const t = await res.text(); return t ? JSON.parse(t) : null;
  },
  beats:{
    async all(){ return await SB.req('GET','beats?order=pinned.desc,created_at.desc') || []; },
    async upsert(b){ return await SB.req('POST','beats',b); },
    async update(id,b){ return await SB.req('PATCH','beats?id=eq.'+id,b); },
    async del(id){ return await SB.req('DELETE','beats?id=eq.'+id); }
  },
  settings:{
    async get(key){
      const r = await SB.req('GET','site_settings?key=eq.'+key+'&select=value');
      return r && r[0] ? r[0].value : null;
    },
    async set(key,value){
      await SB.req('POST','site_settings',{key,value});
    }
  }
};

let beats = [];
let isAdmin = false;
let editingId = null;
let activeFilter = 'all';
let adminPassword = 'grittygrave';

/* ---- Logo ---- */
document.querySelectorAll('.logo-img').forEach(el => el.src = LOGO_DATA);

/* ---- Load settings (bio, password) from Supabase ---- */
async function loadSettings(){
  try{
    const pw = await SB.settings.get('admin_password');
    if(pw) adminPassword = pw;
    const bio = await SB.settings.get('site_bio');
    if(bio){
      document.querySelectorAll('.bio-text-display').forEach(el => el.innerHTML = bio);
    }
  } catch(e){}
}

async function loadBeats(){
  try{ beats = await SB.beats.all(); }
  catch(e){ beats = []; }
}

/* ============================================================
   EMBED PARSING
   ============================================================ */
function buildEmbed(url){
  if(!url) return null;
  const u = url.trim();
  let yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if(yt) return `<iframe height="170" src="https://www.youtube.com/embed/${yt[1]}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  if(/soundcloud\.com/.test(u)) return `<iframe height="166" loading="lazy" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&color=%23a9d92e&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false"></iframe>`;
  if(/beatstars\.com/.test(u)) return `<iframe height="170" loading="lazy" src="${escapeAttr(u)}" style="background:#11150a"></iframe>`;
  let sp = u.match(/spotify\.com\/(track|album|playlist)\/([\w]+)/);
  if(sp) return `<iframe height="152" loading="lazy" src="https://open.spotify.com/embed/${sp[1]}/${sp[2]}"></iframe>`;
  return null;
}

/* ============================================================
   RENDER
   ============================================================ */
function renderFilters(){
  const moods = [...new Set(beats.map(b=>b.mood).filter(Boolean))];
  const bar = document.getElementById('filterBar');
  if(!beats.length){ bar.innerHTML=''; return; }
  bar.innerHTML='';
  const mk=(val,label)=>{
    const b=document.createElement('button');
    b.className='fchip'+(activeFilter===val?' on':'');
    b.textContent=label;
    b.addEventListener('click',()=>{activeFilter=val;renderFilters();renderGrid();});
    return b;
  };
  bar.appendChild(mk('all','All Beats'));
  moods.forEach(m=>bar.appendChild(mk(m,m)));
}

function renderGrid(){
  const grid=document.getElementById('beatGrid');
  const holder=document.getElementById('emptyHolder');
  grid.innerHTML=''; holder.innerHTML='';

  // Pinned beat
  const pinned = beats.find(b=>b.pinned);
  const pinnedEl = document.getElementById('pinnedBeat');
  if(pinnedEl){
    if(pinned){
      pinnedEl.style.display='';
      const embed = buildEmbed(pinned.embed);
      let pills='';
      if(pinned.bpm) pills+=`<span class="bc-pill">${escapeHtml(pinned.bpm)} BPM</span>`;
      if(pinned.key) pills+=`<span class="bc-pill">${escapeHtml(pinned.key)}</span>`;
      if(pinned.mood) pills+=`<span class="bc-pill mood">${escapeHtml(pinned.mood)}</span>`;
      pinnedEl.innerHTML=`
        <div class="pin-label">📌 Featured Beat</div>
        <div class="pin-card">
          <div class="bc-player">${embed||'<div class="no-embed">No player</div>'}</div>
          <div class="bc-info">
            <div class="bc-title">${escapeHtml(pinned.title||'Untitled')}</div>
            <div class="bc-meta">${pills}</div>
            ${pinned.tiktok?`<a class="bc-tiktok" href="${escapeAttr(pinned.tiktok)}" target="_blank" rel="noopener">▶ Watch It Made On TikTok</a>`:''}
          </div>
        </div>`;
    } else {
      pinnedEl.style.display='none';
    }
  }

  if(!beats.length){
    holder.innerHTML=`<div class="empty-state"><div class="es-skull">💀</div><div class="es-title">No Beats In The Grave Yet</div><div class="es-sub">Check back soon.</div></div>`;
    document.getElementById('countLine').textContent='';
    return;
  }

  const shown=beats.filter(b=>activeFilter==='all'||b.mood===activeFilter);
  document.getElementById('countLine').textContent=shown.length+(shown.length===1?' beat':' beats');

  shown.forEach(b=>{
    const card=document.createElement('div');
    card.className='beat-card';
    const embed=buildEmbed(b.embed);
    let pills='';
    if(b.bpm) pills+=`<span class="bc-pill">${escapeHtml(b.bpm)} BPM</span>`;
    if(b.key) pills+=`<span class="bc-pill">${escapeHtml(b.key)}</span>`;
    if(b.mood) pills+=`<span class="bc-pill mood">${escapeHtml(b.mood)}</span>`;
    if(b.pinned) pills+=`<span class="bc-pill" style="color:var(--yellow)">📌 Pinned</span>`;
    const adminRow=isAdmin?`<div class="bc-admin-row">
      <button class="edit" data-edit="${b.id}">Edit</button>
      <button class="pin" data-pin="${b.id}" data-pinned="${b.pinned?'1':'0'}">${b.pinned?'Unpin':'Pin'}</button>
      <button class="del" data-del="${b.id}">Delete</button>
    </div>`:'';
    card.innerHTML=`
      <div class="bc-player">${embed||`<div class="no-embed">No player</div>`}</div>
      <div class="bc-info">
        <div class="bc-title">${escapeHtml(b.title||'Untitled')}</div>
        <div class="bc-meta">${pills}</div>
        ${b.tiktok?`<a class="bc-tiktok" href="${escapeAttr(b.tiktok)}" target="_blank" rel="noopener">▶ Watch It Made On TikTok</a>`:''}
        ${adminRow}
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>startEdit(btn.dataset.edit)));
  grid.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',()=>deleteBeat(btn.dataset.del)));
  grid.querySelectorAll('[data-pin]').forEach(btn=>btn.addEventListener('click',()=>togglePin(btn.dataset.pin, btn.dataset.pinned==='1')));
}

async function togglePin(id, isPinned){
  // Unpin all first
  for(const b of beats){ if(b.pinned) await SB.beats.update(b.id,{pinned:false}); }
  beats.forEach(b=>b.pinned=false);
  if(!isPinned){
    await SB.beats.update(id,{pinned:true});
    const b=beats.find(x=>x.id===id); if(b) b.pinned=true;
    toast('Beat pinned to top');
  } else {
    toast('Beat unpinned');
  }
  renderGrid();
}

function escapeHtml(str){ return String(str).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(str){ return escapeHtml(str).replace(/'/g,'&#39;'); }

/* ============================================================
   ADMIN
   ============================================================ */
const adminModal=document.getElementById('adminModal');
document.getElementById('adminOpen').addEventListener('click',()=>{
  adminModal.classList.add('show');
  if(isAdmin){ showDash(); } else { showLogin(); }
});
document.getElementById('adminClose').addEventListener('click',()=>adminModal.classList.remove('show'));
adminModal.addEventListener('click',e=>{ if(e.target===adminModal) adminModal.classList.remove('show'); });

function showLogin(){
  document.getElementById('loginView').style.display='';
  document.getElementById('dashView').style.display='none';
  document.getElementById('adminTitle').textContent='Admin Login';
  document.getElementById('loginErr').textContent='';
  document.getElementById('pwIn').value='';
}
function showDash(){
  document.getElementById('loginView').style.display='none';
  document.getElementById('dashView').style.display='';
  document.getElementById('adminTitle').textContent='Manage Beats';
  // show correct tab
  switchAdminTab('beats');
  resetForm();
  renderAdminList();
}

document.getElementById('loginBtn').addEventListener('click',tryLogin);
document.getElementById('pwIn').addEventListener('keydown',e=>{ if(e.key==='Enter') tryLogin(); });
function tryLogin(){
  if(document.getElementById('pwIn').value===adminPassword){
    isAdmin=true; showDash(); renderGrid();
  } else {
    document.getElementById('loginErr').textContent='Wrong password.';
  }
}

/* ---- Admin tabs ---- */
function switchAdminTab(tab){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
  document.querySelectorAll('.admin-tab-panel').forEach(p=>p.style.display=p.dataset.panel===tab?'':'none');
}
document.querySelectorAll('.admin-tab-btn').forEach(b=>b.addEventListener('click',()=>switchAdminTab(b.dataset.tab)));

/* ---- Beat form ---- */
function resetForm(){
  editingId=null;
  document.getElementById('formMode').textContent='Add A Beat';
  document.getElementById('saveBeatBtn').textContent='Save Beat';
  ['bTitle','bBpm','bKey','bMood','bEmbed','bTiktok'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('formErr').textContent='';
}
function startEdit(id){
  const b=beats.find(x=>x.id===id); if(!b) return;
  editingId=id;
  document.getElementById('formMode').textContent='Edit Beat';
  document.getElementById('saveBeatBtn').textContent='Update Beat';
  document.getElementById('bTitle').value=b.title||'';
  document.getElementById('bBpm').value=b.bpm||'';
  document.getElementById('bKey').value=b.key||'';
  document.getElementById('bMood').value=b.mood||'';
  document.getElementById('bEmbed').value=b.embed||'';
  document.getElementById('bTiktok').value=b.tiktok||'';
  adminModal.classList.add('show');
  showDash();
  switchAdminTab('beats');
}
document.getElementById('saveBeatBtn').addEventListener('click',saveBeat);
async function saveBeat(){
  const title=document.getElementById('bTitle').value.trim();
  const bpm=document.getElementById('bBpm').value.trim();
  const key=document.getElementById('bKey').value.trim();
  const mood=document.getElementById('bMood').value.trim();
  const embed=document.getElementById('bEmbed').value.trim();
  const tiktok=document.getElementById('bTiktok').value.trim();
  const err=document.getElementById('formErr');
  err.textContent='';
  if(!title){ err.textContent='Give the beat a title.'; return; }
  if(!embed){ err.textContent='Add an embed link.'; return; }
  if(editingId){
    await SB.beats.update(editingId,{title,bpm,key,mood,embed,tiktok});
    const b=beats.find(x=>x.id===editingId);
    if(b) Object.assign(b,{title,bpm,key,mood,embed,tiktok});
    toast('Beat updated');
  } else {
    const nb={id:'beat_'+Date.now(),title,bpm,key,mood,embed,tiktok,pinned:false};
    await SB.beats.upsert(nb);
    beats.unshift(nb);
    toast('Beat added');
  }
  resetForm(); renderAdminList(); renderFilters(); renderGrid();
}
async function deleteBeat(id){
  if(!confirm('Delete this beat?')) return;
  await SB.beats.del(id);
  beats=beats.filter(x=>x.id!==id);
  renderAdminList(); renderFilters(); renderGrid(); toast('Beat deleted');
}
function renderAdminList(){
  const c=document.getElementById('adminBeatList');
  if(!beats.length){ c.innerHTML='<div style="color:var(--muted-2);font-size:12px;font-family:Space Mono,monospace;">No beats yet.</div>'; return; }
  c.innerHTML='';
  beats.forEach(b=>{
    const row=document.createElement('div'); row.className='abl-item';
    row.innerHTML=`<span class="abl-name">${escapeHtml(b.title)}</span><span class="abl-meta">${escapeHtml(b.bpm||'')}${b.bpm?' BPM':''}</span>
      <button class="mini-btn" data-aedit="${b.id}" style="font-size:10px;padding:0 9px;">Edit</button>
      <button class="mini-btn" data-adel="${b.id}" style="font-size:10px;padding:0 9px;color:var(--blood-bright);border-color:var(--blood);">Del</button>`;
    row.querySelector('[data-aedit]').addEventListener('click',()=>startEdit(b.id));
    row.querySelector('[data-adel]').addEventListener('click',()=>deleteBeat(b.id));
    c.appendChild(row);
  });
}

/* ---- Bio editor ---- */
document.getElementById('saveBioBtn').addEventListener('click', async ()=>{
  const bio = document.getElementById('bioInput').value.trim();
  if(!bio) return;
  await SB.settings.set('site_bio', bio);
  document.querySelectorAll('.bio-text-display').forEach(el=>el.innerHTML=bio);
  toast('Bio saved');
});

/* ---- Password change ---- */
document.getElementById('savePasswordBtn').addEventListener('click', async ()=>{
  const cur=document.getElementById('curPassword').value;
  const np=document.getElementById('newPassword').value;
  const np2=document.getElementById('newPassword2').value;
  const err=document.getElementById('pwChangeErr');
  err.textContent='';
  if(cur!==adminPassword){ err.textContent='Current password is wrong.'; return; }
  if(!np||np.length<4){ err.textContent='New password must be at least 4 characters.'; return; }
  if(np!==np2){ err.textContent='New passwords do not match.'; return; }
  await SB.settings.set('admin_password', np);
  adminPassword=np;
  ['curPassword','newPassword','newPassword2'].forEach(id=>document.getElementById(id).value='');
  toast('Password changed');
});

/* ---- Toast ---- */
let toastTimer;
function toast(msg,bad){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show'+(bad?' bad':'');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{ t.className='toast'+(bad?' bad':''); },1700);
}

(async function init(){
  await loadSettings();
  await loadBeats();
  renderFilters();
  renderGrid();
})();
