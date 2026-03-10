const STORAGE_KEY = 'josh-golf-tracker-v5';
const sampleParTemplate = [4,4,3,5,4,4,3,5,4,4,3,4,5,4,3,4,5,4];

const beerwahPins = [
  {lat:-26.8585,lon:152.9580},{lat:-26.8580,lon:152.9592},{lat:-26.8572,lon:152.9602},{lat:-26.8560,lon:152.9610},
  {lat:-26.8552,lon:152.9600},{lat:-26.8545,lon:152.9588},{lat:-26.8542,lon:152.9576},{lat:-26.8555,lon:152.9568},
  {lat:-26.8568,lon:152.9562},{lat:-26.8580,lon:152.9566},{lat:-26.8591,lon:152.9575},{lat:-26.8598,lon:152.9588},
  {lat:-26.8590,lon:152.9601},{lat:-26.8580,lon:152.9613},{lat:-26.8568,lon:152.9620},{lat:-26.8557,lon:152.9614},
  {lat:-26.8549,lon:152.9602},{lat:-26.8546,lon:152.9589}
];

const sampleCourses = [
  { id:'beerwah', name:'Beerwah Golf Club', lat:-26.858, lon:152.958, holes:18, pars: sampleParTemplate,
    lengths:[352,318,157,458,342,361,148,481,336,347,161,358,470,334,152,341,487,355],
    holePins: beerwahPins },
  { id:'pelican', name:'Pelican Waters Golf Club', lat:-26.806, lon:153.123, holes:18, pars: sampleParTemplate },
  { id:'headland', name:'Headland Golf Club', lat:-26.676, lon:153.104, holes:18, pars: sampleParTemplate },
  { id:'maroochy', name:'Maroochy River Golf Club', lat:-26.613, lon:153.036, holes:18, pars: sampleParTemplate },
  { id:'noosa', name:'Noosa Springs Golf & Spa Resort', lat:-26.404, lon:153.081, holes:18, pars: sampleParTemplate },
];

let deferredPrompt = null;
let state = loadState();

function byId(id){ return document.getElementById(id); }
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderAll(); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){ try { return JSON.parse(raw); } catch {} }
  return { courses:[...sampleCourses], rounds:[], activeRoundId:null, activeHole:0, lastPosition:null };
}
function defaultRoundDate(){ const d=new Date(); const tz=d.getTimezoneOffset()*60000; return new Date(d-tz).toISOString().slice(0,10); }
function defaultPars(holes){ return Array.from({length:holes}, (_,i)=> sampleParTemplate[i] || 4); }
function defaultLengths(holes){ return Array.from({length:holes}, (_,i)=> sampleCourses[0].lengths?.[i] || (defaultPars(holes)[i]===3?155:defaultPars(holes)[i]===5?480:350)); }
function pretty(v){ return (v||'').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function pct(a,b){ return b ? `${Math.round((a/b)*100)}%` : '0%'; }
function meters(v){ return typeof v==='number' ? `${Math.round(v*10)/10}m` : '—'; }
function numVal(id){ const v = parseFloat(byId(id).value); return Number.isFinite(v) ? v : null; }
function activeRound(){ return state.rounds.find(r => r.id === state.activeRoundId) || null; }
function activeHoleData(){ const r=activeRound(); return r ? r.holes[state.activeHole] : null; }
function findCourse(id){ return state.courses.find(c => c.id === id); }
function uid(){ return (crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`); }

function holeTemplate(number, par=4, length=350, pin=null){
  return { number, par, length, drive:'', green:'', pinSpot:'center', score:null, putts:null, penalties:0, approach:'', notes:'',
    fir:false, gir:false, upDown:false, sandSave:false, shots:[], pinLat:pin?.lat || null, pinLon:pin?.lon || null };
}

function seedRound(courseId, player, date, tee){
  const course = findCourse(courseId);
  const holes = Array.from({length:course.holes}, (_,i)=>holeTemplate(i+1, course.pars?.[i] || 4, course.lengths?.[i] || 350, course.holePins?.[i] || null));
  const round = { id:uid(), player, date, tee, courseId, createdAt:Date.now(), holes };
  state.rounds.unshift(round);
  state.activeRoundId = round.id;
  state.activeHole = 0;
}

function distanceMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestCourse(lat, lon){
  const choices = state.courses.filter(c => typeof c.lat === 'number' && typeof c.lon === 'number');
  choices.forEach(c => c._d = distanceMeters(lat,lon,c.lat,c.lon));
  choices.sort((a,b)=>a._d-b._d);
  return choices[0] || null;
}

function hookEvents(){
  byId('roundDate').value = defaultRoundDate();
  byId('installBtn').onclick = async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    byId('installBtn').classList.add('hidden');
  };
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e; byId('installBtn').classList.remove('hidden');
  });

  byId('customCourseBtn').onclick = ()=> byId('customCourseForm').classList.toggle('hidden');
  byId('saveCustomCourseBtn').onclick = () => {
    const name = byId('customCourseName').value.trim();
    const holes = parseInt(byId('customCourseHoles').value || '18', 10);
    if(!name) return alert('Add a course name.');
    state.courses.push({ id: uid(), name, holes, pars: defaultPars(holes), lengths: defaultLengths(holes) });
    byId('customCourseName').value='';
    byId('customCourseForm').classList.add('hidden');
    persist();
  };

  byId('useLocationBtn').onclick = ()=> {
    navigator.geolocation.getCurrentPosition(pos => {
      const {latitude, longitude} = pos.coords;
      state.lastPosition = {lat:latitude, lon:longitude};
      const course = nearestCourse(latitude, longitude);
      if(course){
        byId('courseSelect').value = course.id;
        byId('locationResult').textContent = `Nearest saved course: ${course.name} (${meters(course._d)})`;
      } else {
        byId('locationResult').textContent = 'Location found, but no nearby saved course matched.';
      }
      persist();
    }, ()=> alert('Location was blocked. Allow it in Safari and try again.'));
  };

  byId('startRoundBtn').onclick = ()=> {
    seedRound(byId('courseSelect').value, byId('playerName').value.trim() || 'Josh Butler', byId('roundDate').value || defaultRoundDate(), byId('teeSelect').value);
    persist();
  };

  byId('prevHoleBtn').onclick = ()=> { if(state.activeHole > 0){ saveHole(); state.activeHole--; persist(); } };
  byId('nextHoleBtn').onclick = ()=> { const r=activeRound(); if(r && state.activeHole < r.holes.length-1){ saveHole(); state.activeHole++; persist(); } };

  document.querySelectorAll('#driveMap button').forEach(btn => btn.onclick = () => { const hole=activeHoleData(); if(!hole) return; hole.drive=btn.dataset.drive; autoFillFromShots(hole); persist(); });
  document.querySelectorAll('#greenMap button').forEach(btn => btn.onclick = () => { const hole=activeHoleData(); if(!hole) return; hole.green=btn.dataset.green; persist(); });
  document.querySelectorAll('#pinSpotMap button').forEach(btn => btn.onclick = () => { const hole=activeHoleData(); if(!hole) return; hole.pinSpot=btn.dataset.pinspot; persist(); });

  byId('clearShotFormBtn').onclick = clearShotForm;
  byId('addShotBtn').onclick = addShot;
  byId('saveHoleBtn').onclick = saveHole;
  byId('finishRoundBtn').onclick = ()=> { saveHole(); renderAnalysis(); byId('roundAnalysisCard').classList.remove('hidden'); };
  byId('gpsDistanceBtn').onclick = useGpsDistance;
  byId('savePositionBtn').onclick = saveShotPosition;
  byId('editPinBtn').onclick = setPinFromLocation;
}

function populateCourses(){
  const select = byId('courseSelect');
  const current = select.value;
  select.innerHTML = state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  select.value = current || state.courses[0]?.id || '';
}

function useGpsDistance(){
  const hole = activeHoleData();
  if(!hole) return;
  if(typeof hole.pinLat !== 'number' || typeof hole.pinLon !== 'number') return alert('This hole is using the default centre-pin workflow right now. When you reach the green, tap “Save Exact Pin From My Location” if you want GPS-exact pin distance next time, or keep entering metres manually.');
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude} = pos.coords;
    state.lastPosition = {lat:latitude, lon:longitude};
    const d = distanceMeters(latitude, longitude, hole.pinLat, hole.pinLon);
    byId('shotDistanceInput').value = (Math.round(d * 10) / 10).toString();
    persist();
  }, ()=> alert('Location was blocked.'));
}

function saveShotPosition(){
  navigator.geolocation.getCurrentPosition(pos => {
    state.lastPosition = {lat:pos.coords.latitude, lon:pos.coords.longitude};
    persist();
    alert('Shot position saved for this moment. If the hole pin is mapped, GPS distance can now be checked again.');
  }, ()=> alert('Location was blocked.'));
}

function setPinFromLocation(){
  const hole = activeHoleData();
  if(!hole) return;
  navigator.geolocation.getCurrentPosition(pos => {
    hole.pinLat = pos.coords.latitude;
    hole.pinLon = pos.coords.longitude;
    persist();
    alert(`Exact pin saved for Hole ${hole.number}. GPS distance is now live for this hole.`);
  }, ()=> alert('Location was blocked.'));
}

function clearShotForm(){
  byId('shotDistanceInput').value='';
  byId('shotClubInput').value='';
  byId('shotDirectionSelect').value='';
  byId('shotResultSelect').value='';
  byId('shotLieInput').value='';
  byId('shotIsPuttCheck').checked=false;
  byId('shotHitGreenCheck').checked=false;
}

function addShot(){
  const hole = activeHoleData();
  if(!hole) return;
  const distanceToPin = numVal('shotDistanceInput');
  if(distanceToPin === null) return alert('Add the distance to the pin for this shot.');
  const shot = {
    id: uid(),
    shotNo: hole.shots.length + 1,
    distanceToPin,
    club: byId('shotClubInput').value.trim(),
    direction: byId('shotDirectionSelect').value,
    result: byId('shotResultSelect').value,
    lie: byId('shotLieInput').value.trim(),
    isPutt: byId('shotIsPuttCheck').checked,
    hitGreen: byId('shotHitGreenCheck').checked || byId('shotResultSelect').value === 'green',
    position: state.lastPosition ? {...state.lastPosition} : null,
  };
  hole.shots.push(shot);
  autoFillFromShots(hole);
  clearShotForm();
  persist();
}

function autoFillFromShots(hole){
  hole.putts = hole.shots.filter(s => s.isPutt).length || hole.putts;
  hole.score = hole.shots.length || hole.score;
  const first = hole.shots[0];
  if(first && hole.par > 3){
    if(!hole.drive && first.direction) hole.drive = first.direction;
    if(!hole.fir && ['center'].includes(hole.drive)) hole.fir = true;
  }
  if(hole.shots.some(s => s.hitGreen)) hole.gir = true;
  const lastNonPutt = [...hole.shots].reverse().find(s => !s.isPutt);
  if(lastNonPutt && !hole.approach) hole.approach = lastNonPutt.result ? pretty(lastNonPutt.result) : '';
}

function saveHole(){
  const hole = activeHoleData();
  if(!hole) return;
  hole.par = numVal('parInput') || 4;
  if(!hole.pinSpot) hole.pinSpot = 'center';
  hole.length = numVal('holeLengthInput') || 350;
  hole.score = numVal('scoreInput');
  hole.putts = numVal('puttsInput');
  hole.penalties = numVal('penaltiesInput') || 0;
  hole.approach = byId('approachSelect').value;
  hole.notes = byId('notesInput').value;
  hole.fir = byId('firCheck').checked;
  hole.gir = byId('girCheck').checked;
  hole.upDown = byId('upDownCheck').checked;
  hole.sandSave = byId('sandSaveCheck').checked;
  persist();
}

function getApproachProximity(hole){
  for(let i=0;i<hole.shots.length-1;i++){
    const shot = hole.shots[i]; const next = hole.shots[i+1];
    if(!shot.isPutt && shot.hitGreen && typeof next.distanceToPin === 'number') return next.distanceToPin;
  }
  return null;
}
function getDriveDistance(hole){
  if(hole.par===3 || hole.shots.length<2) return null;
  const first = hole.shots[0], second = hole.shots[1];
  if(typeof first.distanceToPin !== 'number' || typeof second.distanceToPin !== 'number') return null;
  const d = first.distanceToPin - second.distanceToPin;
  return d > 0 ? d : null;
}

function clubStats(round){
  const map = {};
  round.holes.forEach(h => h.shots.forEach((s, idx) => {
    const club = (s.club || '').trim();
    if(!club) return;
    if(!map[club]) map[club] = {club, shots:0, distances:[], directions:{left:0,center:0,right:0}, putts:0, greensHit:0};
    const row = map[club];
    row.shots++;
    row.distances.push(s.distanceToPin);
    if(['far-left','left'].includes(s.direction)) row.directions.left++;
    else if(['far-right','right'].includes(s.direction)) row.directions.right++;
    else if(s.direction) row.directions.center++;
    if(s.isPutt) row.putts++;
    if(s.hitGreen) row.greensHit++;
  }));
  return Object.values(map).map(row => ({
    ...row,
    avgDistance: avg(row.distances),
    longest: row.distances.length ? Math.max(...row.distances) : 0,
    greensPct: pct(row.greensHit, row.shots)
  })).sort((a,b)=>b.shots-a.shots);
}

function computeStats(round){
  const played = round.holes.filter(h => h.score !== null || h.shots.length);
  const total = played.reduce((a,h)=>a+(h.score || h.shots.length || 0),0);
  const putts = played.reduce((a,h)=>a+(h.putts || h.shots.filter(s=>s.isPutt).length || 0),0);
  const penalties = played.reduce((a,h)=>a+(h.penalties || 0),0);
  const firEligible = played.filter(h=>h.par>3);
  const firMade = firEligible.filter(h=>h.fir).length;
  const girMade = played.filter(h=>h.gir).length;
  const proximities = played.map(getApproachProximity).filter(v=>typeof v==='number');
  const drives = firEligible.map(getDriveDistance).filter(v=>typeof v==='number');
  const puttMetres = played.flatMap(h=>h.shots.filter(s=>s.isPutt).map(s=>s.distanceToPin)).filter(v=>typeof v==='number');
  const direction = {left:0, center:0, right:0};
  firEligible.forEach(h => {
    if(['far-left','left'].includes(h.drive)) direction.left++;
    else if(['far-right','right'].includes(h.drive)) direction.right++;
    else if(h.drive) direction.center++;
  });
  return {
    holesPlayed: played.length,
    score: total,
    putts,
    penalties,
    firPct: pct(firMade, firEligible.length),
    girPct: pct(girMade, played.length),
    avgApproachProximity: avg(proximities),
    longestDrive: drives.length ? Math.max(...drives) : 0,
    avgDrive: avg(drives),
    totalPuttMetres: puttMetres.reduce((a,b)=>a+b,0),
    avgPuttLength: avg(puttMetres),
    direction
  };
}

function renderHoleMap(hole){
  const wrap = byId('holeMapVisual');
  const greenX = hole.par === 3 ? 50 : hole.par === 5 ? 52 : 54;
  const fairwayWidth = hole.par === 3 ? 18 : hole.par === 5 ? 30 : 24;
  const bunkers = hole.number % 2 === 0;
  wrap.innerHTML = `
    <svg viewBox="0 0 100 220" class="hole-svg" aria-label="Hole map">
      <rect x="0" y="0" width="100" height="220" rx="10" fill="#dbeafe"/>
      <rect x="46" y="195" width="8" height="15" rx="3" fill="#78350f"/>
      <path d="M ${50-fairwayWidth/2} 190 Q 50 120 ${50-fairwayWidth/4} 35 L ${50+fairwayWidth/4} 35 Q 50 120 ${50+fairwayWidth/2} 190 Z" fill="#86efac" stroke="#166534" stroke-width="1.5"/>
      <ellipse cx="${greenX}" cy="26" rx="18" ry="12" fill="#4ade80" stroke="#166534" stroke-width="2"/>
      ${bunkers ? '<ellipse cx="31" cy="40" rx="7" ry="4" fill="#fde68a"/><ellipse cx="67" cy="48" rx="8" ry="4.5" fill="#fde68a"/>' : '<ellipse cx="69" cy="40" rx="7" ry="4" fill="#fde68a"/>'}
      <circle cx="${greenPinPosition(hole.pinSpot || 'center').x}" cy="${greenPinPosition(hole.pinSpot || 'center').y}" r="3.5" fill="#ef4444" stroke="#fff" stroke-width="1"/>
      ${hole.green ? `<circle cx="${greenPinPosition(hole.green).x}" cy="${greenPinPosition(hole.green).y}" r="3" fill="#1d4ed8" stroke="#fff" stroke-width="1"/>` : ''}
      <text x="10" y="16" font-size="9" fill="#0f172a">Par ${hole.par}</text>
      <text x="72" y="16" font-size="9" fill="#0f172a">${hole.length}m</text>
    </svg>`;
  byId('pinMeta').textContent = hole.pinLat ? `Exact GPS pin saved for Hole ${hole.number}` : `Using centre-of-green default pin for Hole ${hole.number}`;
}

function greenPinPosition(green){
  const map = {
    'back-left':{x:41,y:17}, 'back-center':{x:50,y:15}, 'back-right':{x:59,y:17},
    'middle-left':{x:40,y:26}, 'center':{x:50,y:26}, 'middle-right':{x:60,y:26},
    'front-left':{x:41,y:34}, 'front-center':{x:50,y:37}, 'front-right':{x:59,y:34}
  };
  return map[green] || {x:50,y:26};
}

function renderShotList(){
  const hole = activeHoleData();
  const wrap = byId('shotList');
  if(!hole || !hole.shots.length){ wrap.innerHTML = '<div class="mini">No shots added yet.</div>'; return; }
  wrap.innerHTML = hole.shots.map(s => `<div class="shot-row"><div><b>Shot ${s.shotNo}</b> · ${s.club || 'No club'} · ${meters(s.distanceToPin)}</div><div class="mini">${pretty(s.result || 'result n/a')}${s.direction ? ' · '+pretty(s.direction) : ''}${s.isPutt ? ' · Putt' : ''}${s.hitGreen ? ' · On green' : ''}</div></div>`).join('');
}

function renderLiveStats(){
  const r = activeRound();
  if(!r){ byId('liveStats').innerHTML=''; return; }
  const s = computeStats(r);
  const items = [
    ['Score', s.score || 0], ['Putts', s.putts || 0], ['FIR', s.firPct], ['GIR', s.girPct],
    ['Avg Proximity', meters(s.avgApproachProximity)], ['Longest Drive', meters(s.longestDrive)], ['Avg Drive', meters(s.avgDrive)],
    ['Putt Metres', meters(s.totalPuttMetres)], ['Avg Putt', meters(s.avgPuttLength)], ['Miss L/C/R', `${s.direction.left}/${s.direction.center}/${s.direction.right}`]
  ];
  byId('liveStats').innerHTML = items.map(([k,v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
}

function renderClubStats(){
  const r = activeRound();
  const wrap = byId('clubStats');
  if(!r){ wrap.innerHTML=''; return; }
  const rows = clubStats(r);
  if(!rows.length){ wrap.innerHTML='<div class="mini">Club-by-club data will show once shots are entered.</div>'; return; }
  wrap.innerHTML = rows.map(row => `
    <div class="club-card">
      <h3>${row.club}</h3>
      <div class="mini">Shots: ${row.shots} · Avg start distance: ${meters(row.avgDistance)} · Longest start distance: ${meters(row.longest)}</div>
      <div class="mini">Direction L/C/R: ${row.directions.left}/${row.directions.center}/${row.directions.right}</div>
      <div class="mini">Green-finish rate: ${row.greensPct}${row.putts ? ` · Putts: ${row.putts}` : ''}</div>
    </div>
  `).join('');
}

function buildRoundAnalysis(round){
  const s = computeStats(round);
  const notes = [];
  if(parseInt(s.firPct) < 50) notes.push(`Driving accuracy is the first lever. Your FIR is ${s.firPct}, so getting more tee balls in play will cut recovery shots and protect score.`);
  if(s.longestDrive && s.avgDrive < 230) notes.push(`Your measured average drive is ${meters(s.avgDrive)}. Better centred strike and launch could create easier approaches into par 4s.`);
  if(s.avgApproachProximity > 12) notes.push(`Approach proximity sits at ${meters(s.avgApproachProximity)}. The fastest route toward scratch looks like wedge and mid-iron distance control.`);
  if(s.totalPuttMetres > 30) notes.push(`You rolled ${meters(s.totalPuttMetres)} of putts. That suggests first-putt speed control and short-putt conversion should be a priority.`);
  if(s.putts > s.holesPlayed * 1.9) notes.push(`Putting count is heavy at ${s.putts}. Build pace drills from 6–12m and pressure reps inside 2m.`);
  if(parseInt(s.girPct) < 45) notes.push(`GIR is ${s.girPct}. To move toward scratch, you need more full-shot control and fewer defensive up-and-down attempts.`);
  if(s.penalties > 1) notes.push(`Penalty control matters. ${s.penalties} penalties in one round usually wipes out the good work elsewhere.`);
  if(!notes.length) notes.push('This round is moving the right way. Keep stacking fairways, tighter approach windows, and ruthless short-putt conversion.');
  return `<div class="analysis-box"><p><b>Scratch-path summary</b></p><ul>${notes.map(n=>`<li>${n}</li>`).join('')}</ul></div>`;
}

function renderAnalysis(){
  const r = activeRound();
  if(!r) return;
  byId('roundAnalysis').innerHTML = buildRoundAnalysis(r);
}

function renderRoundForm(){
  const r = activeRound();
  const section = byId('roundSection');
  if(!r){ section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  const hole = activeHoleData();
  byId('roundTitle').textContent = `${findCourse(r.courseId)?.name || 'Course'} — ${r.player}`;
  byId('roundMeta').textContent = `${r.date} · ${r.tee} tees`;
  byId('holeBadge').textContent = `Hole ${hole.number}`;
  byId('parInput').value = hole.par;
  byId('holeLengthInput').value = hole.length;
  byId('scoreInput').value = hole.score ?? '';
  byId('puttsInput').value = hole.putts ?? '';
  byId('penaltiesInput').value = hole.penalties ?? 0;
  byId('approachSelect').value = hole.approach || '';
  byId('notesInput').value = hole.notes || '';
  byId('firCheck').checked = !!hole.fir;
  byId('girCheck').checked = !!hole.gir;
  byId('upDownCheck').checked = !!hole.upDown;
  byId('sandSaveCheck').checked = !!hole.sandSave;
  document.querySelectorAll('#driveMap button').forEach(btn => btn.classList.toggle('active', btn.dataset.drive === hole.drive));
  document.querySelectorAll('#greenMap button').forEach(btn => btn.classList.toggle('active', btn.dataset.green === hole.green));
  document.querySelectorAll('#pinSpotMap button').forEach(btn => btn.classList.toggle('active', btn.dataset.pinspot === (hole.pinSpot || 'center')));
  byId('driveValue').textContent = hole.drive ? `Drive miss: ${pretty(hole.drive)}` : 'Drive miss: none selected';
  byId('pinSpotValue').textContent = `Pin position: ${pretty(hole.pinSpot || 'center')}`;
  byId('greenValue').textContent = hole.green ? `Green finish: ${pretty(hole.green)}` : 'Green finish: none selected';
  renderHoleMap(hole);
  renderShotList();
  renderLiveStats();
  renderClubStats();
}

function renderRounds(){
  const wrap = byId('roundList');
  if(!state.rounds.length){ wrap.innerHTML = '<div class="mini">No rounds saved yet.</div>'; return; }
  wrap.innerHTML = state.rounds.map(r => {
    const s = computeStats(r);
    return `<div class="round-item"><b>${findCourse(r.courseId)?.name || 'Course'} · ${r.date}</b><div class="meta">${r.player} · ${r.tee}</div><div class="mini">Score ${s.score || 0} · FIR ${s.firPct} · GIR ${s.girPct} · Longest drive ${meters(s.longestDrive)}</div></div>`;
  }).join('');
}

function renderAll(){
  populateCourses();
  renderRoundForm();
  renderRounds();
}

if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js')); }
window.addEventListener('DOMContentLoaded', ()=> { hookEvents(); renderAll(); });
