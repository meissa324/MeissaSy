// Focus Session: timed work intervals with check-in logs, a study heatmap and day history.
// Runs inside a Shadow DOM so its styles and ids never collide with the site.
// Data stays in this browser: sessions in IndexedDB ('focusSessions'), heatmap in localStorage ('focusHeat.v1').
(() => {
const hostEl = document.getElementById('focusHost');
if (!hostEl) return;
const root = hostEl.attachShadow({mode:'open'});

root.innerHTML = `
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:host{
  display:block;
  --ink:#20251f;--ink2:#3d433b;--ink3:#74796e;
  --paper:#f5f3ed;--paper3:#deded5;--card:#fbfaf6;
  --amber:#c9744c;--amber2:#d98a62;--red:#c95d52;--green:#315b48;--rule:#deded5;
  --mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;--serif:'Playfair Display',serif;
  --shadow:0 16px 45px #2731270c;
  font-family:var(--sans);color:var(--ink);
}
button,input,textarea,select{font:inherit}
button{cursor:pointer}

.app{
  position:relative;display:flex;flex-direction:column;overflow:hidden;
  height:clamp(600px,calc(100vh - 190px),940px);
  background:var(--paper);border:1px solid #dfe2d9;box-shadow:var(--shadow);
}

/* SETUP */
#setupScreen{display:flex;flex-direction:column;align-items:center;flex:1;padding:40px 24px;overflow-y:auto}
#setupScreen > :first-child{margin-top:auto}
#setupScreen > :last-child{margin-bottom:auto}
.setup-masthead{text-align:center;margin-bottom:32px}
.setup-masthead h1{font-family:var(--serif);font-size:clamp(34px,5vw,54px);font-weight:500;letter-spacing:-0.01em;line-height:1;color:var(--ink)}
.setup-masthead p{font:11px var(--mono);letter-spacing:0.15em;text-transform:uppercase;color:var(--ink3);margin-top:10px}
.setup-card{background:var(--card);border:1px solid var(--rule);padding:36px 44px;width:100%;max-width:520px;box-shadow:var(--shadow)}
.field-group{margin-bottom:26px}
.field-group label{display:block;font:10px var(--mono);letter-spacing:0.2em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
.field-group input[type=text]{width:100%;background:var(--paper);border:1px solid var(--rule);font-size:15px;color:var(--ink);padding:10px 14px;outline:none;transition:border-color .15s}
.field-group input[type=text]:focus{border-color:var(--amber)}
.field-group input::placeholder{color:var(--ink3)}
.duration-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dur-input{display:flex;flex-direction:column;gap:4px}
.dur-input label{font:10px var(--mono);letter-spacing:0.2em;text-transform:uppercase;color:var(--ink3)}
.input-wrap{display:flex;align-items:center;background:var(--paper);border:1px solid var(--rule)}
.input-wrap:focus-within{border-color:var(--amber)}
.input-wrap input{background:none;border:none;font:500 22px var(--mono);color:var(--ink);padding:10px 12px;width:100%;outline:none;-moz-appearance:textfield}
.input-wrap input::-webkit-inner-spin-button,.input-wrap input::-webkit-outer-spin-button{-webkit-appearance:none}
.unit{font:600 11px var(--mono);letter-spacing:0.1em;text-transform:uppercase;color:var(--ink3);padding-right:14px;white-space:nowrap}
.start-btn,.restart-btn,.submit-btn{background:var(--ink);color:var(--paper);border:none;font:600 12px var(--mono);letter-spacing:0.2em;text-transform:uppercase;transition:background .15s}
.start-btn{width:100%;padding:16px;margin-top:8px}
.start-btn:hover,.restart-btn:hover,.submit-btn:hover:not(:disabled){background:var(--green)}

/* SESSION */
#sessionScreen,#doneScreen{display:none;flex-direction:column;height:100%;overflow:hidden}
.session-header,.done-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;border-bottom:1px solid var(--rule);background:var(--card);flex-shrink:0}
.session-title{font:italic 18px var(--serif);color:var(--ink2)}
.session-meta{font:11px var(--mono);color:var(--ink3);display:flex;align-items:center;gap:16px}
.session-meta .dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;margin-right:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.end-btn,.dl-btn{background:none;border:1px solid var(--rule);font:600 10px var(--mono);letter-spacing:0.15em;text-transform:uppercase;color:var(--ink3);padding:6px 14px;transition:all .15s}
.end-btn:hover{border-color:var(--red);color:var(--red)}
.dl-btn{padding:5px 12px;font-size:9px}
.dl-btn:hover{border-color:var(--amber);color:var(--amber)}
.dl-btn.danger:hover{border-color:var(--red);color:var(--red)}
.session-body,.done-body{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;min-height:0}
@media(max-width:700px){.session-body,.done-body{grid-template-columns:1fr;grid-template-rows:auto 1fr}}

.timers-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;border-right:1px solid var(--rule);gap:28px;background:var(--card)}
.timer-block{text-align:center}
.timer-block .lbl{font:10px var(--mono);letter-spacing:0.25em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
.main-clock{font:500 clamp(48px,7vw,76px) var(--mono);color:var(--ink);letter-spacing:-0.02em;line-height:1}
.main-clock.ending{color:var(--red)}
.progress-ring-wrap{position:relative;display:inline-block;margin-top:12px}
.progress-ring-wrap svg{transform:rotate(-90deg)}
.ring-bg{fill:none;stroke:var(--paper3);stroke-width:3}
.ring-fg{fill:none;stroke:var(--amber);stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset .8s linear}
.ring-fg.ending{stroke:var(--red)}
.ring-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.interval-clock{font:500 clamp(22px,3.5vw,28px) var(--mono);color:var(--ink2);line-height:1}
.interval-clock.ringing{color:var(--red);animation:flashRed .4s infinite}
@keyframes flashRed{0%,100%{opacity:1}50%{opacity:.3}}
.ring-lbl{font:9px var(--mono);letter-spacing:0.2em;text-transform:uppercase;color:var(--ink3);margin-top:3px}
.interval-num{font:11px var(--mono);color:var(--ink3);letter-spacing:0.05em;margin-top:4px}
.timer-divider{width:1px;height:36px;background:var(--rule);display:block}

.log-panel,.done-right{display:flex;flex-direction:column;overflow:hidden;background:var(--paper);min-height:0}
.log-header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--rule);flex-shrink:0}
.log-header h2{font:500 16px var(--serif);color:var(--ink2)}
.log-actions{display:flex;gap:8px}
.log-entries{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column}
.log-entry{display:grid;grid-template-columns:52px 1fr;padding:14px 0;border-bottom:1px solid var(--rule);animation:slideIn .3s ease}
@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.log-entry:last-child{border-bottom:none}
.entry-time{font:10px/1.4 var(--mono);color:var(--ink3);padding-top:2px}
.entry-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.entry-tag{font:600 9px var(--mono);letter-spacing:0.2em;text-transform:uppercase;color:var(--amber)}
.entry-tag.final{color:var(--green)}
.entry-text{font-size:13px;line-height:1.55;color:var(--ink)}
.verdict-pill{font:600 9px var(--mono);letter-spacing:0.12em;text-transform:uppercase;padding:2px 7px;border:1px solid currentColor}
.verdict-pill.productive{color:var(--green)}
.verdict-pill.unproductive{color:var(--red)}
.entry-shot{display:block;max-width:100%;max-height:90px;margin-top:8px;border:1px solid var(--rule);cursor:zoom-in}
.entry-shot.big{max-height:none;cursor:zoom-out}
.shots-removed{font-size:11px;font-style:italic;color:var(--ink3);margin-top:6px}
.log-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ink3);text-align:center;gap:8px;padding:40px}
.log-empty svg{opacity:.25}
.log-empty p{font:11px/1.7 var(--mono);letter-spacing:0.06em}

/* HEATMAP */
.heat-wrap{width:100%;max-width:820px;margin-top:32px;background:var(--card);border:1px solid var(--rule);padding:18px 22px 14px;box-shadow:var(--shadow)}
.heat-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.heat-title{font:500 16px var(--serif);color:var(--ink2)}
.heat-summary{font:11px var(--mono);color:var(--ink3)}
.heat-scroll{overflow-x:auto;padding-bottom:6px}
.heat-inner{width:max-content}
.heat-months{display:grid;grid-auto-flow:column;grid-auto-columns:11px;gap:3px;margin-left:30px;height:14px;font:10px var(--mono);color:var(--ink3)}
.heat-months span{white-space:nowrap;overflow:visible}
.heat-body{display:flex;gap:4px}
.heat-days{display:grid;grid-template-rows:repeat(7,11px);gap:3px;width:26px;font:9px/11px var(--mono);color:var(--ink3)}
.heat-grid{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;grid-auto-columns:11px;gap:3px}
.heat-grid i{display:block;width:11px;height:11px;border-radius:2px;background:var(--paper3)}
.heat-grid i.l1,.sw.l1{background:#bfdccb}
.heat-grid i.l2,.sw.l2{background:#7fb99a}
.heat-grid i.l3,.sw.l3{background:#3f8a66}
.heat-grid i.l4,.sw.l4{background:#1b4332}
.heat-grid i.today{outline:1px solid var(--ink3);outline-offset:1px}
.heat-grid i.l1,.heat-grid i.l2,.heat-grid i.l3,.heat-grid i.l4{cursor:pointer}
.heat-grid i.l1:hover,.heat-grid i.l2:hover,.heat-grid i.l3:hover,.heat-grid i.l4:hover{outline:1px solid var(--ink);outline-offset:1px}
.heat-legend{display:flex;align-items:center;justify-content:flex-end;gap:4px;font:10px var(--mono);color:var(--ink3);margin-top:6px}
.sw{width:11px;height:11px;border-radius:2px;background:var(--paper3);display:inline-block}

/* MODALS */
#checkinModal,#dayModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(32,37,31,.7);backdrop-filter:blur(4px)}
#checkinModal{z-index:1000}
#dayModal{z-index:1100}
#checkinModal.open,#dayModal.open{display:flex}
.modal-box{background:var(--card);width:min(540px,94vw);border-top:3px solid var(--amber);box-shadow:0 8px 40px rgba(32,37,31,.25);animation:modalIn .25s cubic-bezier(.34,1.56,.64,1);padding:34px 38px 30px;max-height:94vh;overflow-y:auto}
@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(12px)}to{opacity:1;transform:none}}
.modal-alarm-header{display:flex;align-items:flex-start;gap:14px;margin-bottom:22px}
.alarm-icon{width:38px;height:38px;flex-shrink:0;background:var(--amber);display:flex;align-items:center;justify-content:center;animation:wobble .5s infinite;color:#fff}
@keyframes wobble{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
.modal-interval-badge{font:10px var(--mono);letter-spacing:0.2em;text-transform:uppercase;color:var(--amber);margin-bottom:4px}
.modal-heading{font:500 22px/1.2 var(--serif);color:var(--ink)}
.modal-subtext{font-size:12px;color:var(--ink3);line-height:1.5;margin-bottom:16px}
.verdict-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.verdict-btn{padding:14px;border:1px solid var(--rule);background:var(--paper);font:600 12px var(--mono);letter-spacing:0.15em;text-transform:uppercase;color:var(--ink2);transition:all .15s}
.verdict-btn.productive:hover{border-color:var(--green);color:var(--green)}
.verdict-btn.unproductive:hover{border-color:var(--red);color:var(--red)}
.verdict-btn.productive.selected{background:var(--green);border-color:var(--green);color:#fff}
.verdict-btn.unproductive.selected{background:var(--red);border-color:var(--red);color:#fff}
.checkin-textarea{width:100%;min-height:90px;resize:vertical;background:var(--paper);border:1px solid var(--rule);font-size:14px;color:var(--ink);padding:12px 14px;outline:none;line-height:1.55;transition:border-color .15s}
.checkin-textarea:focus{border-color:var(--amber)}
.shots{display:flex;flex-wrap:wrap;gap:8px}
.shots:not(:empty){margin-top:10px}
.shot{position:relative}
.shot img{height:64px;display:block;border:1px solid var(--rule)}
.shot button{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:var(--ink);color:#fff;font-size:11px;line-height:18px}
.shot button:hover{background:var(--red)}
.modal-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
.char-hint{font:10px var(--mono);color:var(--ink3)}
.submit-btn{font-size:11px;padding:12px 28px}
.submit-btn:disabled{opacity:.4;cursor:not-allowed}

/* DAY HISTORY */
.day-box{background:var(--card);width:min(660px,94vw);max-height:90vh;display:flex;flex-direction:column;border-top:3px solid var(--green);box-shadow:0 8px 40px rgba(32,37,31,.25)}
.day-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:22px 28px 14px;border-bottom:1px solid var(--rule)}
.day-head h3{font:500 20px var(--serif);color:var(--ink)}
.day-sub{font:11px var(--mono);color:var(--ink3);margin-top:4px}
.day-close{background:none;border:none;font-size:24px;line-height:1;color:var(--ink3)}
.day-close:hover{color:var(--red)}
.day-body{overflow-y:auto;padding:4px 28px 16px;flex:1}
.day-empty{font-size:13px;color:var(--ink3);padding:20px 0;line-height:1.6}
.sess{border-bottom:1px solid var(--rule);padding:14px 0}
.sess:last-child{border-bottom:none}
.sess summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.sess summary::-webkit-details-marker{display:none}
.sess-title{font:italic 17px var(--serif);color:var(--ink2)}
.sess-meta{font:11px var(--mono);color:var(--ink3)}
.sess-actions{display:flex;gap:8px;margin:12px 0 4px}
.day-foot{border-top:1px solid var(--rule);padding:10px 28px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font:11px var(--mono);color:var(--ink3)}
.day-foot select{font:11px var(--mono);color:var(--ink2);background:var(--paper);border:1px solid var(--rule);padding:3px 6px}

/* DONE */
.done-header span{font:italic 18px var(--serif);color:var(--green)}
.done-left{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;border-right:1px solid var(--rule);background:var(--card);text-align:center;gap:16px}
.done-checkmark{width:64px;height:64px;border:2px solid var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--green);flex-shrink:0}
.done-left h2{font:500 28px var(--serif);color:var(--ink)}
.done-left p{font-size:13px;color:var(--ink3);line-height:1.6;max-width:260px}
.done-stats{display:flex;gap:28px;margin-top:8px}
.done-stat{text-align:center}
.done-stat .num{font:500 28px var(--mono);color:var(--amber)}
.done-stat .lbl{font:10px var(--mono);letter-spacing:0.15em;text-transform:uppercase;color:var(--ink3);margin-top:2px}
.restart-btn{margin-top:8px;padding:12px 32px;font-size:11px}

::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--rule)}
::-webkit-scrollbar-thumb:hover{background:var(--ink3)}
</style>

<div class="app">
  <div id="setupScreen">
    <div class="setup-masthead">
      <h1>Focus Session</h1>
      <p>Work with intention — log every interval</p>
    </div>
    <div class="setup-card">
      <div class="field-group">
        <label>Session name</label>
        <input type="text" id="setupLabel" placeholder="e.g. Deep work — Dynamics & Control" maxlength="60"/>
      </div>
      <div class="field-group">
        <div class="duration-row">
          <div class="dur-input">
            <label>Total session</label>
            <div class="input-wrap"><input type="number" id="setupTotal" min="1" max="480" value="60"/><span class="unit">min</span></div>
          </div>
          <div class="dur-input">
            <label>Check-in interval</label>
            <div class="input-wrap"><input type="number" id="setupInterval" min="1" max="60" value="5"/><span class="unit">min</span></div>
          </div>
        </div>
      </div>
      <button class="start-btn" id="startBtn">Begin Session</button>
    </div>

    <div class="heat-wrap">
      <div class="heat-head">
        <span class="heat-title">Study activity</span>
        <span class="heat-summary" id="heatSummary"></span>
      </div>
      <div class="heat-scroll" id="heatScroll">
        <div class="heat-inner">
          <div class="heat-months" id="heatMonths"></div>
          <div class="heat-body">
            <div class="heat-days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
            <div class="heat-grid" id="heatGrid"></div>
          </div>
        </div>
      </div>
      <div class="heat-legend">Less
        <span class="sw"></span><span class="sw l1"></span><span class="sw l2"></span><span class="sw l3"></span><span class="sw l4"></span>
      More</div>
    </div>
  </div>

  <div id="sessionScreen">
    <div class="session-header">
      <span class="session-title" id="sessionTitleDisplay">Session</span>
      <div class="session-meta">
        <span><span class="dot"></span>RUNNING</span>
        <span id="sessionIntervalMeta"></span>
      </div>
      <button class="end-btn" id="endBtn">End Session</button>
    </div>
    <div class="session-body">
      <div class="timers-panel">
        <div class="timer-block">
          <div class="lbl">Session remaining</div>
          <div class="main-clock" id="mainClock">00:00</div>
        </div>
        <span class="timer-divider"></span>
        <div class="timer-block">
          <div class="lbl">Next check-in</div>
          <div class="progress-ring-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle class="ring-bg" cx="70" cy="70" r="60"/>
              <circle class="ring-fg" id="ringFg" cx="70" cy="70" r="60" stroke-dasharray="376.99" stroke-dashoffset="0"/>
            </svg>
            <div class="ring-inner">
              <div class="interval-clock" id="intervalClock">00:00</div>
              <div class="ring-lbl">interval</div>
            </div>
          </div>
          <div class="interval-num" id="intervalNum">check-in #1</div>
        </div>
      </div>
      <div class="log-panel">
        <div class="log-header">
          <h2>Session Log</h2>
          <div class="log-actions">
            <button class="dl-btn" id="dlTxtBtn">↓ TXT</button>
            <button class="dl-btn" id="dlPdfBtn">↓ PDF</button>
          </div>
        </div>
        <div class="log-entries" id="logEntries">
          <div class="log-empty">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="4" width="20" height="24" rx="1"/><line x1="10" y1="11" x2="22" y2="11"/><line x1="10" y1="15" x2="22" y2="15"/><line x1="10" y1="19" x2="16" y2="19"/></svg>
            <p>Your check-in notes will<br/>appear here as you work.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="doneScreen">
    <div class="done-header">
      <span id="doneTitleDisplay">Session Complete</span>
      <div class="log-actions">
        <button class="dl-btn" id="doneDlTxtBtn">↓ TXT</button>
        <button class="dl-btn" id="doneDlPdfBtn">↓ PDF</button>
      </div>
    </div>
    <div class="done-body">
      <div class="done-left">
        <div class="done-checkmark"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5,14 11,20 23,8"/></svg></div>
        <h2>Session Complete</h2>
        <p id="doneDescription">You completed your focus session.</p>
        <div class="done-stats">
          <div class="done-stat"><div class="num" id="doneTotalTime">—</div><div class="lbl">minutes</div></div>
          <div class="done-stat"><div class="num" id="doneCheckCount">—</div><div class="lbl">check-ins</div></div>
        </div>
        <button class="restart-btn" id="restartBtn">New Session</button>
      </div>
      <div class="done-right">
        <div class="log-header"><h2>Full Log</h2></div>
        <div class="log-entries" id="doneLogEntries"></div>
      </div>
    </div>
  </div>

  <div id="checkinModal">
    <div class="modal-box">
      <div class="modal-alarm-header">
        <div class="alarm-icon"><svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1a7 7 0 0 1 7 7c0 3.1-1 4.5-2 5.8H5C4 14.5 3 13.1 3 8a7 7 0 0 1 7-7zm-2.5 14h5a2.5 2.5 0 0 1-5 0z"/></svg></div>
        <div>
          <div class="modal-interval-badge" id="modalBadge">Check-in #1</div>
          <div class="modal-heading">Was that interval productive?</div>
        </div>
      </div>
      <p class="modal-subtext">Pick one, then press Enter to log it. The note and screenshots are optional (Shift+Enter for a new line).</p>
      <div class="verdict-row">
        <button type="button" class="verdict-btn productive" data-v="productive">Productive</button>
        <button type="button" class="verdict-btn unproductive" data-v="unproductive">Unproductive</button>
      </div>
      <textarea class="checkin-textarea" id="checkinText" maxlength="508"></textarea>
      <div class="shots" id="shots"></div>
      <div class="modal-footer">
        <span class="char-hint" id="charHint">0 / 500 · paste screenshots with Ctrl+V</span>
        <button class="submit-btn" id="submitCheckin" disabled>Log it →</button>
      </div>
    </div>
  </div>

  <div id="dayModal">
    <div class="day-box">
      <div class="day-head">
        <div><h3 id="dayTitle"></h3><div class="day-sub" id="daySub"></div></div>
        <button class="day-close" id="dayClose" title="Close">×</button>
      </div>
      <div class="day-body" id="dayBody"></div>
      <div class="day-foot">
        <span id="storageInfo"></span>
        <label>Auto-delete screenshots after
          <select id="shotKeep">
            <option value="0">never</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
          </select>
        </label>
      </div>
    </div>
  </div>
</div>`;

const $ = id => root.getElementById(id);
const $$ = sel => root.querySelectorAll(sel);

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx = null, alarmActive = false, alarmTimeout = null;
const getCtx = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());

function playBeepPattern(){
  if(!alarmActive) return;
  const ctx = getCtx();
  const pattern = [{f:1047,dur:.07,gap:.05},{f:1319,dur:.07,gap:.05},{f:1047,dur:.07,gap:.05},{f:1319,dur:.12,gap:.5}];
  let t = ctx.currentTime;
  pattern.forEach(p => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = p.f;
    g.gain.setValueAtTime(.2, t);
    g.gain.exponentialRampToValueAtTime(.001, t + p.dur);
    o.start(t); o.stop(t + p.dur);
    t += p.dur + p.gap;
  });
  alarmTimeout = setTimeout(playBeepPattern, pattern.reduce((a,p) => a + p.dur + p.gap, 0) * 1000);
}
function startAlarm(){ alarmActive = true; playBeepPattern(); }
function stopAlarm(){ alarmActive = false; clearTimeout(alarmTimeout); }

// ─── Tab icon: only shown while a session is running or ringing ──────────────
let iconLink = null;
function setIcon(state){
  if(iconLink){ iconLink.remove(); iconLink = null; }
  if(state === 'idle') return;
  const c = state === 'alarm' ? '#c95d52' : '#315b48';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='30' fill='${c}'/><path d='M32 15v18l12 7' fill='none' stroke='white' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  document.querySelectorAll('link[rel~="icon"]').forEach(l => l.remove());
  iconLink = document.createElement('link');
  iconLink.rel = 'icon'; iconLink.type = 'image/svg+xml';
  iconLink.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  document.head.appendChild(iconLink);
}

// ─── Study heatmap (localStorage: { "YYYY-MM-DD": seconds }) ─────────────────
const HEAT_KEY = 'focusHeat.v1';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = n => String(n).padStart(2,'0');
const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
function loadHeat(){ try{ return JSON.parse(localStorage.getItem(HEAT_KEY)) || {}; }catch(e){ return {}; } }
function addStudySeconds(sec){
  if(sec <= 0) return;
  const h = loadHeat(), k = dayKey(new Date());
  h[k] = (h[k] || 0) + sec;
  const cutoff = dayKey(new Date(Date.now() - 430*864e5));
  for(const key in h) if(key < cutoff) delete h[key];
  try{ localStorage.setItem(HEAT_KEY, JSON.stringify(h)); }catch(e){}
}
const heatLevel = sec => { const m = sec/60; return m<=0 ? 0 : m<30 ? 1 : m<60 ? 2 : m<120 ? 3 : 4; };
function renderHeat(){
  const data = loadHeat();
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - 52*7);
  const todayKey = dayKey(today);
  let cells = '', months = '', lastMonth = -1, total = 0;
  for(let d = new Date(start); d <= today; d.setDate(d.getDate()+1)){
    const k = dayKey(d), sec = data[k] || 0;
    total += sec;
    const mins = Math.round(sec/60);
    const label = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    cells += `<i data-k="${k}" class="l${heatLevel(sec)}${k===todayKey?' today':''}" title="${mins?mins+' min':'No study'} · ${label}"></i>`;
    if(d.getDay() === 0){
      const mo = d.getMonth();
      months += `<span>${mo!==lastMonth ? MONTHS[mo] : ''}</span>`;
      lastMonth = mo;
    }
  }
  $('heatGrid').innerHTML = cells;
  $('heatMonths').innerHTML = months;
  const hrs = total/3600;
  $('heatSummary').textContent = (hrs>=10 ? Math.round(hrs) : hrs.toFixed(1)) + ' h in the last year';
  const sc = $('heatScroll'); sc.scrollLeft = sc.scrollWidth;
}
renderHeat();

// ─── State & helpers ─────────────────────────────────────────────────────────
let session = null, mainTick = null;

function createSession(label, totalMin, intervalMin){
  return {
    label: label || 'Focus Session',
    totalMs: totalMin*60000, intervalMs: intervalMin*60000,
    remainingTotal: totalMin*60000, remainingInterval: intervalMin*60000,
    intervalCount: 0, startTime: Date.now(), log: [], savedMs: 0, daySecs: {},
    done: false, pendingCheckin: false,
  };
}
function fmtMs(ms){
  const t = Math.max(0, Math.ceil(ms/1000));
  const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const fmtElapsed = ms => `${pad(Math.floor(ms/60000))}:${pad(Math.floor((ms%60000)/1000))}`;
const escHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Check-ins pop up inside the Focus panel, so bring it forward if the user wandered off.
function revealPanel(){
  const view = document.getElementById('workspaceView');
  const panel = document.getElementById('panel-focus');
  if(view && view.classList.contains('active') && !panel.classList.contains('active')){
    document.querySelector('.workspace-tabs [data-panel="focus"]').click();
  }
}

// ─── Start session ───────────────────────────────────────────────────────────
$('startBtn').addEventListener('click', () => {
  getCtx();
  const label = $('setupLabel').value.trim();
  const total = parseInt($('setupTotal').value) || 60;
  const interval = parseInt($('setupInterval').value) || 5;
  session = createSession(label, total, interval);
  $('sessionTitleDisplay').textContent = session.label;
  $('sessionIntervalMeta').textContent = `every ${interval} min`;
  $('setupScreen').style.display = 'none';
  $('sessionScreen').style.display = 'flex';
  setIcon('run');
  updateTimerUI();
  runSession();
});

function runSession(){
  let lastTick = Date.now();
  mainTick = setInterval(() => {
    if(session.pendingCheckin || session.done) return;
    const now = Date.now(), delta = now - lastTick;
    lastTick = now;
    session.remainingTotal -= delta;
    session.remainingInterval -= delta;
    if(session.remainingInterval <= 0){
      session.remainingInterval = session.intervalMs;
      session.intervalCount++;
      triggerCheckin(false);
    }
    if(session.remainingTotal <= 0){
      session.remainingTotal = 0;
      session.done = true;
      clearInterval(mainTick);
      if(!session.pendingCheckin) triggerCheckin(true);
    }
    updateTimerUI();
  }, 100);
}

function updateTimerUI(){
  if(!session) return;
  const ending = session.remainingTotal < 60000;
  $('mainClock').textContent = fmtMs(session.remainingTotal);
  $('mainClock').className = 'main-clock' + (ending ? ' ending' : '');
  $('intervalClock').textContent = fmtMs(session.remainingInterval);
  $('intervalClock').className = 'interval-clock' + (session.pendingCheckin ? ' ringing' : '');
  $('ringFg').style.strokeDashoffset = 376.99 * (1 - session.remainingInterval / session.intervalMs);
  $('ringFg').setAttribute('class', 'ring-fg' + (ending ? ' ending' : ''));
  $('intervalNum').textContent = `check-in #${session.intervalCount + 1}`;
}

// ─── Session history (IndexedDB) ─────────────────────────────────────────────
// DB_VERSION: bump when stores/indexes change (add a step in onupgradeneeded).
// REC_VERSION: bump when a saved session's shape changes (add a step in migrateRecord).
const DB_NAME = 'focusSessions', DB_VERSION = 1, REC_VERSION = 1;
let dbPromise = null;

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    if(!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => {
      if(e.oldVersion < 1){
        r.result.createObjectStore('sessions',{keyPath:'id'}).createIndex('day','day');
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbPromise;
}
function idbReq(mode, fn){
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction('sessions', mode);
    const out = fn(tx.objectStore('sessions'));
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = tx.onabort = () => rej(tx.error);
  }));
}
function migrateRecord(r){ if(!r.v) r.v = 1; return r; }

function dataURLtoBlob(u){
  const [h, b] = u.split(',');
  const bin = atob(b), a = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], {type: h.match(/:(.*?);/)[1]});
}
const blobToDataURL = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });

function sessionRecord(s){
  return {
    v: REC_VERSION, id: s.startTime, label: s.label, startTime: s.startTime,
    day: dayKey(new Date(s.startTime)),
    totalMs: s.totalMs, intervalMs: s.intervalMs,
    elapsedMs: s.totalMs - s.remainingTotal,
    daySecs: s.daySecs,
    log: s.log.map(e => ({
      index:e.index, timestamp:e.timestamp, elapsed:e.elapsed, verdict:e.verdict, note:e.note, isFinal:e.isFinal,
      shots:(e.shots||[]).map(sh => ({blob:(sh.blob = sh.blob || dataURLtoBlob(sh.data)), w:sh.w, h:sh.h})),
    })),
  };
}
const saveSession = s => idbReq('readwrite', st => st.put(sessionRecord(s))).catch(err => console.warn('focus: save failed', err));

async function hydrate(r){
  const log = await Promise.all(r.log.map(async e => ({
    ...e,
    shots: await Promise.all((e.shots||[]).map(async sh => ({data: await blobToDataURL(sh.blob), w:sh.w, h:sh.h}))),
  })));
  return {id:r.id, label:r.label, startTime:r.startTime, totalMs:r.totalMs, remainingTotal:r.totalMs - r.elapsedMs, daySecs:r.daySecs||{}, log};
}
async function loadDaySessions(key){
  const [y, mo, d] = key.split('-').map(Number);
  const prev = dayKey(new Date(y, mo-1, d-1)); // sessions that ran past midnight
  const recs = await idbReq('readonly', st => st.index('day').getAll(IDBKeyRange.bound(prev, key)));
  const keep = (recs||[]).map(migrateRecord)
    .filter(r => r.day === key || (r.daySecs && r.daySecs[key] > 0))
    .sort((a, b) => a.startTime - b.startTime);
  return Promise.all(keep.map(hydrate));
}

const prefs = () => { try{ return JSON.parse(localStorage.getItem('focusPrefs.v1')) || {}; }catch(e){ return {}; } };
function setPref(k, v){ const p = prefs(); p[k] = v; try{ localStorage.setItem('focusPrefs.v1', JSON.stringify(p)); }catch(e){} }
async function pruneShots(){
  const days = prefs().shotDays | 0;
  if(!days) return;
  const cutoff = dayKey(new Date(Date.now() - days*864e5));
  try{
    const db = await openDB();
    await new Promise(res => {
      const tx = db.transaction('sessions','readwrite');
      const req = tx.objectStore('sessions').index('day').openCursor(IDBKeyRange.upperBound(cutoff, true));
      req.onsuccess = () => {
        const c = req.result; if(!c) return;
        const r = c.value; let changed = false;
        r.log.forEach(e => { if(e.shots && e.shots.length){ e.shots = []; e.shotsRemoved = true; changed = true; } });
        if(changed) c.update(r);
        c.continue();
      };
      tx.oncomplete = tx.onerror = tx.onabort = res;
    });
  }catch(e){}
}
async function updateStorageInfo(){
  try{
    const {usage} = await navigator.storage.estimate();
    $('storageInfo').textContent = `Storage used: ${(usage/1048576).toFixed(1)} MB`;
  }catch(e){ $('storageInfo').textContent = ''; }
}

// ─── Day panel ───────────────────────────────────────────────────────────────
const fmtDur = sec => { const m = Math.round(sec/60); return m < 60 ? `${m} min` : `${Math.floor(m/60)} h ${m%60} min`; };
const dayModal = $('dayModal');

async function openDay(key){
  const body = $('dayBody');
  const [y, mo, d] = key.split('-').map(Number);
  $('dayTitle').textContent = new Date(y, mo-1, d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const total = loadHeat()[key] || 0;
  $('daySub').textContent = `${fmtDur(total)} studied`;
  body.innerHTML = '<p class="day-empty">Loading…</p>';
  dayModal.dataset.key = key;
  dayModal.classList.add('open');

  let sessions = [];
  try{ sessions = await loadDaySessions(key); }catch(e){}
  if(!dayModal.classList.contains('open') || dayModal.dataset.key !== key) return;

  $('daySub').textContent = `${fmtDur(total)} studied` + (sessions.length ? ` · ${sessions.length} session${sessions.length>1?'s':''}` : '');
  body.innerHTML = '';
  if(!sessions.length) body.innerHTML = '<p class="day-empty">No saved log for this day — only the study time was recorded.</p>';
  sessions.forEach(s => body.appendChild(sessionCard(s, key)));
  updateStorageInfo();
}

function sessionCard(s, key){
  const det = document.createElement('details');
  det.className = 'sess'; det.open = true;
  const secs = s.daySecs[key] ?? Math.round((s.totalMs - s.remainingTotal)/1000);
  const {p, u} = verdictCounts(s);
  const t = new Date(s.startTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  det.innerHTML = `
    <summary>
      <span class="sess-title">${escHtml(s.label)}</span>
      <span class="sess-meta">${t} · ${fmtDur(secs)} · ${p} productive / ${u} unproductive</span>
    </summary>
    <div class="sess-actions"></div>
    <div class="sess-log"></div>`;
  const acts = det.querySelector('.sess-actions');
  [['↓ TXT', () => downloadTxt(s), ''], ['↓ PDF', () => downloadPdf(s), ''], ['Delete', () => deleteSession(s), ' danger']]
    .forEach(([label, fn, extra]) => {
      const b = document.createElement('button');
      b.className = 'dl-btn' + extra; b.textContent = label; b.onclick = fn;
      acts.appendChild(b);
    });
  const logEl = det.querySelector('.sess-log');
  if(!s.log.length) logEl.innerHTML = '<p class="day-empty">No check-ins were logged.</p>';
  s.log.forEach(e => addLogEntry(e, logEl));
  return det;
}

async function deleteSession(s){
  if(!confirm('Delete this session, its log and screenshots? This can’t be undone.')) return;
  try{ await idbReq('readwrite', st => st.delete(s.id)); }catch(e){}
  const h = loadHeat();
  for(const k in s.daySecs){
    h[k] = Math.max(0, (h[k]||0) - s.daySecs[k]);
    if(!h[k]) delete h[k];
  }
  try{ localStorage.setItem(HEAT_KEY, JSON.stringify(h)); }catch(e){}
  renderHeat();
  openDay(dayModal.dataset.key);
}

$('heatGrid').addEventListener('click', e => {
  const c = e.target.closest('i[data-k]');
  if(c && /\bl[1-4]\b/.test(c.className)) openDay(c.dataset.k);
});
$('dayClose').addEventListener('click', () => dayModal.classList.remove('open'));
dayModal.addEventListener('click', e => { if(e.target === dayModal) dayModal.classList.remove('open'); });

const keepSel = $('shotKeep');
keepSel.value = String(prefs().shotDays | 0);
keepSel.addEventListener('change', () => { setPref('shotDays', +keepSel.value); pruneShots().then(updateStorageInfo); });

try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){}
pruneShots();

// best-effort save if the tab is closed mid-session
window.addEventListener('pagehide', () => { if(session && !session.done){ flushStudy(); saveSession(session); } });

// ─── Check-in modal ──────────────────────────────────────────────────────────
let isFinalCheckin = false, verdict = null, shots = [];
const PREFIX = 'because ';
const noteEl = $('checkinText'), submitEl = $('submitCheckin'), checkinModal = $('checkinModal');
let lastNote = PREFIX;

function triggerCheckin(isFinal){
  isFinalCheckin = isFinal;
  session.pendingCheckin = true;
  startAlarm();
  setIcon('alarm');
  revealPanel();

  $('modalBadge').textContent = isFinal ? 'Session Complete' : `Check-in #${session.intervalCount}`;
  verdict = null; shots = []; renderShots();
  $$('.verdict-btn').forEach(b => b.classList.remove('selected'));
  noteEl.value = lastNote = PREFIX;
  submitEl.disabled = true;
  updateHint();
  checkinModal.classList.add('open');
  setTimeout(() => { noteEl.focus(); noteEl.setSelectionRange(PREFIX.length, PREFIX.length); }, 100);
}

function updateHint(){
  $('charHint').textContent = `${Math.max(0, noteEl.value.length - PREFIX.length)} / 500 · paste screenshots with Ctrl+V`;
}

$$('.verdict-btn').forEach(b => b.addEventListener('click', () => {
  verdict = b.dataset.v;
  $$('.verdict-btn').forEach(x => x.classList.toggle('selected', x === b));
  submitEl.disabled = false;
  noteEl.focus();
  noteEl.setSelectionRange(noteEl.value.length, noteEl.value.length);
}));

// the "because " prefix can't be removed
function clampCaret(){
  if(root.activeElement !== noteEl) return;
  if(noteEl.selectionStart < PREFIX.length) noteEl.setSelectionRange(PREFIX.length, Math.max(noteEl.selectionEnd, PREFIX.length));
}
['select','click','keyup','mouseup','focus','selectionchange'].forEach(ev => noteEl.addEventListener(ev, clampCaret));
noteEl.addEventListener('beforeinput', e => {
  if(e.inputType.startsWith('deleteContentBackward') && noteEl.selectionStart === noteEl.selectionEnd && noteEl.selectionStart <= PREFIX.length) e.preventDefault();
});
noteEl.addEventListener('input', () => {
  if(!noteEl.value.startsWith(PREFIX)){
    noteEl.value = lastNote;
    noteEl.setSelectionRange(noteEl.value.length, noteEl.value.length);
  }
  lastNote = noteEl.value;
  updateHint();
});
noteEl.addEventListener('keydown', e => {
  if(e.key === 'Backspace' && noteEl.selectionStart === noteEl.selectionEnd && noteEl.selectionStart <= PREFIX.length) e.preventDefault();
  if(e.key === 'Home'){ e.preventDefault(); noteEl.setSelectionRange(PREFIX.length, PREFIX.length); }
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){
    e.preventDefault();
    if(!submitEl.disabled) submitEl.click();
  }
});

// Document-level keys: Enter submits from anywhere in the popup, Escape closes the day panel
// (the check-in popup itself can't be escaped). composedPath()[0] is the real target inside the shadow root.
document.addEventListener('keydown', e => {
  const open = checkinModal.classList.contains('open');
  if(e.key === 'Escape'){
    if(open) e.preventDefault();
    else dayModal.classList.remove('open');
    return;
  }
  if(e.key !== 'Enter' || e.isComposing || !open) return;
  const t = e.composedPath()[0];
  if(t === noteEl || (t.closest && (t.closest('.verdict-btn') || t.closest('.shot button')))) return;
  e.preventDefault();
  if(!submitEl.disabled) submitEl.click();
});

// screenshots: paste into the popup
function shrinkImage(file){
  return new Promise(res => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 1600/Math.max(img.width, img.height));
      const w = Math.round(img.width*sc), h = Math.round(img.height*sc);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res({data:c.toDataURL('image/jpeg', .88), w, h});
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
checkinModal.addEventListener('paste', async e => {
  const files = [...(e.clipboardData?.items||[])].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
  if(!files.length) return;
  e.preventDefault();
  for(const f of files){ const shot = await shrinkImage(f); if(shot) shots.push(shot); }
  renderShots();
});
function renderShots(){
  const box = $('shots');
  box.innerHTML = '';
  shots.forEach((sh, i) => {
    const d = document.createElement('div'); d.className = 'shot';
    d.innerHTML = `<img src="${sh.data}" alt="screenshot ${i+1}"/><button type="button" title="Remove">×</button>`;
    d.querySelector('button').onclick = () => { shots.splice(i, 1); renderShots(); };
    box.appendChild(d);
  });
}

// save study time into the heatmap (only the part not yet saved)
function flushStudy(){
  if(!session) return;
  const delta = Math.round(((session.totalMs - session.remainingTotal) - session.savedMs)/1000);
  if(delta <= 0) return;
  session.savedMs += delta*1000;
  const dk = dayKey(new Date());
  session.daySecs[dk] = (session.daySecs[dk]||0) + delta;
  addStudySeconds(delta);
}

submitEl.addEventListener('click', () => {
  if(!verdict) return;
  stopAlarm();
  const rest = noteEl.value.slice(PREFIX.length).trim();
  const entry = {
    index: session.log.length + 1, timestamp: Date.now(),
    elapsed: session.totalMs - session.remainingTotal,
    verdict, note: rest ? PREFIX + rest : '', shots, isFinal: isFinalCheckin,
  };
  session.log.push(entry);
  addLogEntry(entry, $('logEntries'));
  flushStudy();
  saveSession(session);

  session.pendingCheckin = false;
  checkinModal.classList.remove('open');
  if(isFinalCheckin || session.done) endSession(); else setIcon('run');
});

function addLogEntry(entry, container){
  const empty = container.querySelector('.log-empty');
  if(empty) empty.remove();
  const el = document.createElement('div');
  el.className = 'log-entry';
  el.innerHTML = `
    <div class="entry-time">${fmtElapsed(entry.elapsed)}</div>
    <div class="entry-body">
      <div class="entry-head">
        <span class="entry-tag ${entry.isFinal?'final':''}">${entry.isFinal ? '✓ Final' : `Interval ${entry.index}`}</span>
        <span class="verdict-pill ${entry.verdict}">${entry.verdict === 'productive' ? 'Productive' : 'Unproductive'}</span>
      </div>
      ${entry.note ? `<div class="entry-text">${escHtml(entry.note)}</div>` : ''}
      ${(entry.shots||[]).map(sh => `<img class="entry-shot" src="${sh.data}" alt="screenshot"/>`).join('')}
      ${entry.shotsRemoved ? '<div class="shots-removed">Screenshots auto-deleted</div>' : ''}
    </div>`;
  el.querySelectorAll('.entry-shot').forEach(im => im.addEventListener('click', () => im.classList.toggle('big')));
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

// ─── End session ─────────────────────────────────────────────────────────────
function abortSession(){
  stopAlarm();
  clearInterval(mainTick);
  session.pendingCheckin = false;
  checkinModal.classList.remove('open');
  endSession();
}
$('endBtn').addEventListener('click', () => { if(confirm('End this session early?')) abortSession(); });

function endSession(){
  clearInterval(mainTick);
  flushStudy();
  saveSession(session);
  setIcon('idle');
  const totalMin = Math.round((session.totalMs - session.remainingTotal)/60000);
  $('sessionScreen').style.display = 'none';
  $('doneScreen').style.display = 'flex';
  $('doneTitleDisplay').textContent = session.label;
  $('doneDescription').textContent = `"${session.label}" — completed with ${session.log.length} check-in${session.log.length!==1?'s':''}.`;
  $('doneTotalTime').textContent = totalMin || 1;
  $('doneCheckCount').textContent = session.log.length;
  const doneLog = $('doneLogEntries');
  doneLog.innerHTML = '';
  session.log.forEach(e => addLogEntry(e, doneLog));
}

$('restartBtn').addEventListener('click', () => {
  session = null;
  $('doneScreen').style.display = 'none';
  $('setupScreen').style.display = 'flex';
  renderHeat();
});

// ─── Downloads ───────────────────────────────────────────────────────────────
function fileBase(s){
  const date = new Date(s.startTime).toLocaleDateString('en-US',{month:'short',day:'numeric'}).toLowerCase();
  const title = (s.label || 'focus session').replace(/[\\/:*?"<>|]+/g, '').trim() || 'focus session';
  return `${date}-${title}`.toLowerCase();
}
function verdictCounts(s){
  const p = s.log.filter(e => e.verdict === 'productive').length;
  return {p, u: s.log.length - p};
}
function generateTxt(s){
  const {p, u} = verdictCounts(s);
  const lines = [
    'FOCUS SESSION LOG', '═══════════════════════════════════════',
    `Session: ${s.label}`,
    `Date: ${new Date(s.startTime).toLocaleString()}`,
    `Duration: ${Math.round((s.totalMs - s.remainingTotal)/60000)} minutes`,
    `Check-ins: ${s.log.length} (${p} productive, ${u} unproductive)`,
    '═══════════════════════════════════════', '',
  ];
  s.log.forEach(e => {
    lines.push(`[${fmtElapsed(e.elapsed)}] ${e.isFinal ? 'FINAL' : `CHECK-IN #${e.index}`} — ${e.verdict.toUpperCase()}`);
    if(e.note) lines.push(e.note);
    if(e.shots && e.shots.length) lines.push(`[${e.shots.length} screenshot${e.shots.length>1?'s':''} — included in the PDF]`);
    lines.push('');
  });
  return lines.join('\n');
}
function downloadTxt(s){
  const url = URL.createObjectURL(new Blob([generateTxt(s)], {type:'text/plain'}));
  const a = document.createElement('a');
  a.href = url; a.download = `${fileBase(s)}.txt`; a.click();
  URL.revokeObjectURL(url);
}

let jsPdfPromise = null;
function loadJsPdf(){
  if(window.jspdf) return Promise.resolve(window.jspdf);
  return jsPdfPromise || (jsPdfPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => res(window.jspdf);
    s.onerror = () => { jsPdfPromise = null; rej(new Error('Could not load the PDF library')); };
    document.head.appendChild(s);
  }));
}

async function downloadPdf(s){
  let lib;
  try{ lib = await loadJsPdf(); }catch(err){ alert(err.message + '. Check your connection and try again.'); return; }
  const doc = new lib.jsPDF({unit:'mm', format:'a4'});
  const pw = 210, ph = 297, ml = 20, mr = 20, w = pw - ml - mr;
  let y;

  doc.setFillColor(32,37,31); doc.rect(0, 0, pw, 14, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(245,243,237);
  doc.text('FOCUS SESSION LOG', ml, 9.5);

  y = 28;
  doc.setFontSize(20); doc.setTextColor(32,37,31);
  doc.text(s.label || 'Focus Session', ml, y);
  y += 7;

  const {p, u} = verdictCounts(s);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(116,121,110);
  doc.text(`${new Date(s.startTime).toLocaleString()} · ${Math.round((s.totalMs - s.remainingTotal)/60000)} minutes · ${s.log.length} check-ins (${p} productive, ${u} unproductive)`, ml, y);
  y += 5;
  doc.setDrawColor(222,222,213); doc.line(ml, y, pw - mr, y);
  y += 8;

  s.log.forEach((e, i) => {
    if(y > ph - 30){ doc.addPage(); y = 20; }
    const tag = e.isFinal ? 'FINAL' : `CHECK-IN #${e.index}`;
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(201,116,76);
    doc.text(tag, ml, y);
    const tw = doc.getTextWidth(tag);
    if(e.verdict === 'productive') doc.setTextColor(49,91,72); else doc.setTextColor(201,93,82);
    doc.text(e.verdict.toUpperCase(), ml + tw + 4, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(116,121,110);
    doc.text(fmtElapsed(e.elapsed), pw - mr - 20, y, {align:'right'});
    y += 5;

    if(e.note){
      doc.setFontSize(11); doc.setTextColor(32,37,31);
      doc.splitTextToSize(e.note, w).forEach(line => {
        if(y > ph - 20){ doc.addPage(); y = 20; }
        doc.text(line, ml, y);
        y += 5.5;
      });
      y += 2;
    }
    (e.shots||[]).forEach(sh => {
      let iw = w, ih = iw*sh.h/sh.w;
      if(ih > 95){ ih = 95; iw = ih*sh.w/sh.h; }
      if(y + ih > ph - 20){ doc.addPage(); y = 20; }
      doc.addImage(sh.data, 'JPEG', ml, y, iw, ih);
      y += ih + 4;
    });
    y += 2;
    if(i < s.log.length - 1){
      doc.setDrawColor(222,222,213); doc.line(ml, y, pw - mr, y);
      y += 6;
    }
  });
  doc.save(`${fileBase(s)}.pdf`);
}

['dlTxtBtn','doneDlTxtBtn'].forEach(id => $(id).addEventListener('click', () => downloadTxt(session)));
['dlPdfBtn','doneDlPdfBtn'].forEach(id => $(id).addEventListener('click', () => downloadPdf(session)));

// ─── Hooks for the rest of the site ──────────────────────────────────────────
// The heatmap can only scroll to "today" once the panel is actually visible.
document.querySelector('.workspace-tabs [data-panel="focus"]')?.addEventListener('click', () => requestAnimationFrame(renderHeat));

window.FocusSession = {
  isRunning: () => !!session && !session.done,
  abort: () => { if(session && !session.done) abortSession(); },
};
})();
