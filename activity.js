// Dashboard activity grid: completed tasks (Supabase `notes`) + focus time (localStorage 'focusHeat.v1'), one cell per day.
(() => {
const host = document.getElementById('activityHost');
if (!host) return;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = n => String(n).padStart(2, '0');
const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const level = p => p <= 0 ? 0 : p < 1 ? 1 : p < 2 ? 2 : p < 4 ? 3 : 4;

host.innerHTML = `
<style>
.act-head{display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap}
.act-scroll{overflow-x:auto;margin-top:20px;padding-bottom:6px}
.act-inner{min-width:760px}
.act-months,.act-grid{display:grid;grid-template-columns:repeat(53,1fr);gap:3px}
.act-months{margin-bottom:5px;font:10px var(--mono);color:var(--muted)}
.act-months span{white-space:nowrap}
.act-grid{grid-template-rows:repeat(7,auto);grid-auto-flow:column}
.act-grid i{aspect-ratio:1;background:#e4e7de;border-radius:2px}
.act-grid i.l1,.act-key i.l1{background:#bfdccb}.act-grid i.l2,.act-key i.l2{background:#7fb99a}
.act-grid i.l3,.act-key i.l3{background:#3f8a66}.act-grid i.l4,.act-key i.l4{background:#1b4332}
.act-grid i.today{outline:1px solid var(--ink);outline-offset:1px}
.act-key{display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:12px;font:10px var(--mono);color:var(--muted)}
.act-key i{width:12px;height:12px;background:#e4e7de;border-radius:2px;display:block}
</style>
<div class="panel"><div class="act-head"><div><div class="kicker">Progress</div><h2>Work done</h2><span class="panel-sub" id="actSummary"></span></div></div>
<div class="act-scroll" id="actScroll"><div class="act-inner"><div class="act-months" id="actMonths"></div><div class="act-grid" id="actGrid"></div></div></div>
<div class="act-key">LESS <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> MORE</div>
<span class="panel-sub">Each task completed = 1 · every 30 min of focus = 1</span></div>`;

window.renderActivity = () => {
  let focus = {};
  try { focus = JSON.parse(localStorage.getItem('focusHeat.v1')) || {}; } catch (e) {}
  const tasks = {};
  (window.notes || notes || []).forEach(n => {
    if (n.completed && n.completed_at) { const k = key(new Date(n.completed_at)); tasks[k] = (tasks[k] || 0) + 1; }
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() - 52 * 7);
  let cells = '', months = '', lastMonth = -1, totalTasks = 0, totalSec = 0, week = 0;
  const pts = {};
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const k = key(d), t = tasks[k] || 0, sec = focus[k] || 0, p = t + sec / 1800;
    pts[k] = p; totalTasks += t; totalSec += sec;
    const label = d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    const tip = p ? `${t} task${t === 1 ? '' : 's'} · ${Math.round(sec / 60)} min focus · ${label}` : `No activity · ${label}`;
    cells += `<i class="l${level(p)}${d.getTime() === today.getTime() ? ' today' : ''}" title="${tip}"></i>`;
    if (d.getDay() === 0) {
      if (d.getMonth() !== lastMonth) { months += `<span style="grid-column:${week + 1}">${MONTHS[d.getMonth()]}</span>`; lastMonth = d.getMonth(); }
      week++;
    }
  }
  document.getElementById('actGrid').innerHTML = cells;
  document.getElementById('actMonths').innerHTML = months;
  const hrs = totalSec / 3600;
  document.getElementById('actSummary').textContent = `${totalTasks} task${totalTasks === 1 ? '' : 's'} completed · ${hrs >= 10 ? Math.round(hrs) : hrs.toFixed(1)} h focused in the last year`;

  const d = new Date(today);
  if (!(pts[key(d)] > 0)) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (pts[key(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
  const el = document.getElementById('streakCount');
  if (el) el.textContent = (streak ? '● ' : '') + pad(streak);
  const sc = document.getElementById('actScroll'); sc.scrollLeft = sc.scrollWidth;
};

document.querySelector('.workspace-tabs [data-panel="dashboard"]')?.addEventListener('click', () => requestAnimationFrame(window.renderActivity));
window.renderActivity();
})();
