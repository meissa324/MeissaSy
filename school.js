// School panel: add / archive / delete courses, one saved notes page per course (Supabase `courses` table).
(() => {
const host = document.getElementById('panel-school');
if (!host) return;

let courses = [], view = 'active', openId = null;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail = e => showAuthMessage(e.message, true);

host.innerHTML = `
<style>
.sc-add{display:flex;gap:10px;margin:22px 0 6px}
.sc-add input{flex:1;border:1px solid var(--line);background:#fffdf8;padding:12px;outline:none}
.sc-tabs{display:flex;gap:8px;margin:18px 0 4px}
.sc-tabs button,.sc-act{border:1px solid var(--line);background:none;padding:8px 10px;font:11px var(--mono);color:var(--ink)}
.sc-tabs button.active{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.sc-row{display:flex;justify-content:space-between;align-items:center;gap:14px;border-top:1px solid var(--line);padding:16px 0}
.sc-row strong{font-size:15px;cursor:pointer}
.sc-row .panel-sub{display:block;margin-top:4px}
.sc-actions{display:flex;gap:8px;flex:none}
.sc-act:hover{background:#eceee5}.sc-act.danger{color:var(--red)}
.sc-notes{min-height:420px;margin-top:18px;font:14px/1.6 var(--sans)}
.sc-bar{display:flex;align-items:center;gap:12px;margin-top:14px}
</style>
<div class="panel" id="scPanel"></div>`;
const panel = host.querySelector('#scPanel');

const fmt = d => new Intl.DateTimeFormat('en', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}).format(new Date(d));

function renderList() {
  const shown = courses.filter(c => c.archived === (view === 'archived'));
  panel.innerHTML = `<div class="kicker">Study system</div><h2>Courses & notes</h2><span class="panel-sub">The things worth returning to.</span>
  <div class="sc-add"><input id="scName" maxlength="100" placeholder="New course name…"><button class="btn" id="scAdd">ADD COURSE +</button></div>
  <div class="sc-tabs"><button data-v="active" class="${view==='active'?'active':''}">ACTIVE</button><button data-v="archived" class="${view==='archived'?'active':''}">ARCHIVED</button></div>
  <div>${shown.map(c => `<div class="sc-row"><div><strong data-open="${c.id}">${esc(c.name)}</strong><span class="panel-sub">${c.notes_updated_at ? 'Notes saved ' + fmt(c.notes_updated_at) : 'No notes yet'}</span></div>
    <div class="sc-actions"><button class="sc-act" data-open="${c.id}">OPEN</button><button class="sc-act" data-arch="${c.id}">${c.archived ? 'RESTORE' : 'ARCHIVE'}</button><button class="sc-act danger" data-del="${c.id}">DELETE</button></div></div>`).join('')
    || `<div class="sc-row"><span class="panel-sub">${view === 'active' ? 'No courses yet. Add your first one above.' : 'Nothing archived.'}</span></div>`}</div>`;

  const input = panel.querySelector('#scName');
  const add = async () => {
    const name = input.value.trim();
    if (!name) return;
    if (!db) return showAuthMessage('Connect Supabase before adding private data.', true);
    const {data, error} = await db.from('courses').insert({name}).select().single();
    if (error) return fail(error);
    courses.push(data); view = 'active'; renderList();
  };
  panel.querySelector('#scAdd').onclick = add;
  input.onkeydown = e => { if (e.key === 'Enter') add(); };
  panel.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; renderList(); });
  panel.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { openId = b.dataset.open; renderCourse(); });
  panel.querySelectorAll('[data-arch]').forEach(b => b.onclick = async () => {
    const c = courses.find(x => x.id === b.dataset.arch), archived = !c.archived;
    const {error} = await db.from('courses').update({archived}).eq('id', c.id);
    if (error) return fail(error);
    c.archived = archived; renderList();
  });
  panel.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const c = courses.find(x => x.id === b.dataset.del);
    if (!window.confirm(`Delete "${c.name}" and its notes? This can't be undone.`)) return;
    const {error} = await db.from('courses').delete().eq('id', c.id);
    if (error) return fail(error);
    courses = courses.filter(x => x.id !== c.id); renderList();
  });
}

function renderCourse() {
  const c = courses.find(x => x.id === openId);
  if (!c) { openId = null; return renderList(); }
  panel.innerHTML = `<button class="sc-act" id="scBack">← COURSES</button>
  <div class="kicker" style="margin-top:18px">${c.archived ? 'Archived course' : 'Course'}</div><h2>${esc(c.name)}</h2>
  <textarea class="sc-notes" id="scNotes" maxlength="50000" placeholder="Outline, formulas, things to review…"></textarea>
  <div class="sc-bar"><button class="btn" id="scSave">SAVE NOTES</button><span class="panel-sub" id="scStatus">${c.notes_updated_at ? 'Saved ' + fmt(c.notes_updated_at) : 'Not saved yet'}</span></div>`;
  const ta = panel.querySelector('#scNotes'), status = panel.querySelector('#scStatus');
  ta.value = c.notes;

  const dirty = () => ta.value !== c.notes;
  const save = async () => {
    if (!dirty()) { status.textContent = 'Nothing to save'; return true; }
    const notes = ta.value, notes_updated_at = new Date().toISOString();
    status.textContent = 'Saving…';
    const {error} = await db.from('courses').update({notes, notes_updated_at}).eq('id', c.id);
    if (error) { status.textContent = 'Not saved'; fail(error); return false; }
    c.notes = notes; c.notes_updated_at = notes_updated_at;
    status.textContent = 'Saved ' + fmt(notes_updated_at);
    return true;
  };
  ta.oninput = () => { status.textContent = 'Unsaved changes'; };
  ta.onkeydown = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
  panel.querySelector('#scSave').onclick = save;
  panel.querySelector('#scBack').onclick = async () => {
    if (dirty() && !(await save())) return;
    openId = null; renderList();
  };
}

window.loadSchool = async () => {
  const {data, error} = await db.from('courses').select('*').order('created_at', {ascending: true});
  if (error) return fail(error);
  courses = data || []; openId = null; renderList();
};

renderList();
})();
