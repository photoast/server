(() => {
/* Missed Connections local concept.
 * Camera lifecycle adapted from app/components/CameraCapture.tsx and app/[slug]/booth/page.tsx.
 * Slot cover/clip pipeline adapted from lib/boothSamples.ts:renderLayoutPreviewCanvas.
 * Independent static entry intentionally avoids existing auth, upload, payment and print APIs.
 */
'use strict';
const app = document.getElementById('app');
const questions = [
'새로운 사람들과 시간을 보내면 에너지가 생기는 편이다.',
'약속이 없는 저녁에는 사람을 만나기보다 혼자 쉬고 싶다.',
'대화를 시작할 때는 상대가 먼저 말을 걸어주길 기다리는 편이다.',
'주말에는 가보지 않은 장소나 활동을 경험하고 싶다.',
'새로운 일을 할 때는 즉흥적으로 정하기보다 미리 계획하고 싶다.',
'나와 다른 취향의 이야기도 궁금해서 더 물어보는 편이다.',
'대화할 때는 여러 주제를 가볍게 나누기보다 한 주제를 깊게 이야기하고 싶다.',
'의견이 다를 때는 내 결론보다 상대가 그렇게 생각한 이유를 먼저 알고 싶다.',
'처음 만나는 자리에서는 감정이나 생각보다 가벼운 일상 이야기가 더 편하다.',
'음악·영화·전시 같은 문화 이야기를 나누는 시간이 즐겁다.',
'산책·운동·야외 활동을 함께하는 시간이 즐겁다.',
'맛집·카페·요리를 주제로 이야기하는 시간이 즐겁다.'
];
const labels = ['전혀 그렇지 않다','그렇지 않은 편이다','어느 쪽도 아니다','그런 편이다','매우 그렇다'];
const regions = ['강남·서초','마포·서대문','성수·건대','강서·마곡','그 외 서울','서울 외'];
const prices = ['무료 체험만','1만원 이하','1만원 초과~2만원','2만원 초과~3만원','3만원 초과','아직 모르겠어요'];
const sampleAnswers=[4,2,2,5,2,5,4,5,2,5,4,3];
let state={step:'landing',q:0,answers:Array(12).fill(null),adult:false,photos:Array(4).fill(null),selected:0,editing:false,crops:Array.from({length:4},()=>({zoom:1,x:0,y:0})),sample:false,quick:false,demoAnswers:false,region:regions[0],price:prices[1]};
let stream=null,sequence=0,counting=false,stripBlob=null,stripURL=null,toastTimer,renderVersion=0,singleRetake=false;
const storageKey='mc-concept-draft-v1';
try{const d=JSON.parse(sessionStorage.getItem(storageKey));if(d&&d.expires>Date.now()&&d.version===1&&Array.isArray(d.answers)&&d.answers.length===12&&d.answers.every(v=>v===null||(Number.isInteger(v)&&v>=1&&v<=5))){state.answers=d.answers;state.adult=d.adult===true;state.demoAnswers=d.demoAnswers===true;state.q=Math.max(0,Math.min(11,Number(d.q)||0));}}catch{}
function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify({version:1,expires:Date.now()+7200000,answers:state.answers,adult:state.adult,demoAnswers:state.demoAnswers,q:state.q}));}catch{}}
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function stopCamera(){sequence++;counting=false;singleRetake=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}}
function invalidateStrip(){renderVersion++;if(stripURL)URL.revokeObjectURL(stripURL);stripBlob=null;stripURL=null;}
function disposePhotos(){state.photos.forEach(p=>{if(p&&p.url)URL.revokeObjectURL(p.url)});state.photos=Array(4).fill(null);state.crops=Array.from({length:4},()=>({zoom:1,x:0,y:0}));invalidateStrip();}
function clearAll(){stopCamera();disposePhotos();state.answers=Array(12).fill(null);state.adult=false;state.q=0;state.sample=false;state.quick=false;state.demoAnswers=false;try{sessionStorage.removeItem(storageKey)}catch{};go('landing');}
const stages=['landing','onboarding','quiz','capture','reveal','strip','waitlist','success'];
function go(step,replace=false){
 if(!stages.includes(step))step='landing';
 if(!state.adult&&!['landing','onboarding'].includes(step))step='onboarding';
 if(['capture','reveal','strip'].includes(step)&&!state.answers.every(Number.isInteger))step='quiz';
 if(['reveal','strip'].includes(step)&&!state.photos.every(Boolean)){step='capture';toast('사진은 새로고침하면 사라져요. 네 장을 다시 준비해 주세요.');}
 if(step==='strip'&&!stripURL)step='reveal';
 if(step==='success'&&state.step!=='waitlist'&&state.step!=='success')step='waitlist';
 if(step!==state.step){stopCamera();renderVersion++;}
 state.step=step;history[replace?'replaceState':'pushState']({step},'',`#${step}`);render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});
}
window.addEventListener('popstate',()=>go(location.hash.slice(1)||'landing',true));
function top(label,back){return `<div class="topline"><button class="back" data-go="${back}" aria-label="이전 화면으로">← 이전</button><span>${label}</span></div>`;}
function primary(text,id){return `<button class="primary" id="${id}">${text}<span class="arrow" aria-hidden="true">↗</span></button>`;}
function privacyLink(){return '<button class="text-button" data-privacy>사진과 응답은 어떻게 처리하나요?</button>';}
function profile(){const n=state.answers.map((v,i)=>[1,2,4,8].includes(i)?(5-v)/4:(v-1)/4);const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;const social=mean(n.slice(0,3)),explore=mean(n.slice(3,6)),depth=mean(n.slice(6,9));const choose=(v,lo,mid,hi)=>v<.4?lo:v>.6?hi:mid;
 const title=choose(explore,'익숙한 순간을 아끼는 사람','자기만의 속도로 만나는 사람','새로움에 마음을 여는 사람');
 const interest=['음악과 영화','산책과 야외 활동','맛집과 커피'];const max=Math.max(...n.slice(9));const topics=max<=.25?'새로운 대화 소재':interest.filter((_,i)=>n[i+9]===max).join(' · ');
 return {title,social:choose(social,'익숙해질 시간을 소중히 여겨요.','상황에 맞춰 대화의 속도를 조절해요.','먼저 대화를 여는 데 편안한 편이에요.'),explore:choose(explore,'편안한 루틴 속 즐거움을 발견해요.','익숙함과 새로움을 모두 즐겨요.','새로운 경험에 호기심이 있어요.'),depth:choose(depth,'가벼운 일상에서 이야기를 시작해요.','가벼움과 깊이 사이를 유연하게 오가요.','한 주제에 깊이 머무르는 대화를 좋아해요.'),topics};}
function sampleSVG(index){const shifts=[0,18,-12,8],x=shifts[index];return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="480" viewBox="0 0 780 480"><defs><linearGradient id="b" x2=".8" y2="1"><stop stop-color="#bdc0b3"/><stop offset="1" stop-color="#545b50"/></linearGradient><pattern id="p" width="7" height="7" patternUnits="userSpaceOnUse"><circle r=".6" fill="#fff" opacity=".12"/></pattern></defs><rect width="780" height="480" fill="url(#b)"/><path d="M100 480V200a170 170 0 01340 0v280" fill="#cfd0c1" opacity=".24"/><path d="M520 0v480M555 0v480M590 0v480" stroke="#e5e5d7" stroke-width="2" opacity=".2"/><ellipse cx="${386+x}" cy="480" rx="190" ry="170" fill="#292f29"/><path d="M${350+x} 292l-30 61 66 100 76-105-43-57" fill="#b5b7a7"/><ellipse cx="${386+x}" cy="220" rx="77" ry="98" fill="#c9cbbd"/><path d="M${304+x} 224q-12-143 87-131 105 4 77 143l-23-64q-70 32-106-3z" fill="#30382e"/><path d="M${353+x} 230h14m44 0h14" stroke="#666e60" stroke-width="4"/><path d="M${370+x} 273q18 12 36-2" fill="none" stroke="#747c6d" stroke-width="3"/><rect width="780" height="480" fill="url(#p)"/><text x="24" y="449" fill="#e9e9d9" font-family="monospace" font-size="15" letter-spacing="4">STUDY NO. 0${index+1} / ILLUSTRATION</text></svg>`;}
const sampleSrc=i=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sampleSVG(i));
function heroStrip(offset=0){return `<div class="hero-strip ${offset?'second':''}">${[0,1,2,3].map(i=>`<img src="${sampleSrc((i+offset)%4)}" alt="흑백 인물 샘플 그래픽" width="100" height="53">`).join('')}<small>missed connections · demo</small></div>`;}
function render(){
 const p=state.answers.every(Number.isInteger)?profile():null;
 const screens={
 landing:()=>`<section class="hero"><span class="eyebrow">SOMEWHERE BETWEEN US.</span><h1>어쩌면,<br>우리가 만났어야<br>할 이유.</h1><p class="lead">열두 개의 질문, 네 장의 나.<br>아직 만나지 않은 대화의 시작을 담아보세요.</p><div class="hero-art" aria-label="흑백 포토스트립 샘플 그래픽"><span class="asterisk" aria-hidden="true">✳</span>${heroStrip()}${heroStrip(1)}<span class="art-note">FOUR FRAMES.<br>ONE POSSIBILITY.<br>샘플 그래픽</span><span class="stamp">A little less chance,<br>a little more us.</span></div>${primary(state.answers.some(Boolean)?'이어서 나의 네 컷 만들기':'나의 네 컷 만들기','start')}<p class="disclosure center">만 19세 이상 · 체험판 · 실제 상대와 연결되지 않아요</p><div class="center"><button class="text-button" id="quick">샘플로 빠르게 둘러보기 ↗</button></div><div class="journey"><span><b>01 / DISCOVER</b>나를 알아보고</span><span><b>02 / CAPTURE</b>네 컷을 담고</span><span><b>03 / KEEP</b>가능성을 간직해요</span></div><div class="center">${privacyLink()}</div></section>`,
 onboarding:()=>`${top('BEFORE WE BEGIN','landing')}<section class="section"><span class="eyebrow">A NOTE FOR YOU</span><h1>시작하기 전,<br>작은 약속.</h1><p class="intro">지금은 나를 알아보는 체험이에요.<br>실제 만남은 앞으로의 이야기로 남겨둘게요.</p><div class="ticket"><div class="ticket-line"><b>01</b>12문항으로 나의 대화 방식 찾기</div><div class="ticket-line"><b>02</b>촬영하거나 사진을 골라 네 컷 만들기</div><div class="ticket-line"><b>03</b>나의 흑백 포토스트립 저장하기</div></div><div style="margin-top:22px"><label class="check"><input id="adult" type="checkbox" ${state.adult?'checked':''}><span>만 19세 이상입니다.<small>이 확인은 본인 인증을 대신하지 않아요.</small></span></label><label class="check"><input id="local-agree" type="checkbox"><span>체험 안내와 로컬 처리 방식을 확인했어요.<small>사진은 서버로 보내지 않으며 실제 매칭은 없어요.</small></span></label></div><div class="actions">${primary('확인하고 시작하기','onboard-next')}</div><div class="center">${privacyLink()}</div><div id="error" role="alert"></div></section>`,
 quiz:()=>`${top(`QUESTION ${String(state.q+1).padStart(2,'0')} / 12`,state.q?'quiz':'onboarding')}<div class="progress" role="progressbar" aria-label="설문 진행" aria-valuemin="0" aria-valuemax="12" aria-valuenow="${state.q+1}"><span style="width:${(state.q+1)/12*100}%"></span></div><span class="eyebrow">NO RIGHT ANSWERS. JUST YOU.</span><fieldset class="quiz-options"><legend class="question">${questions[state.q]}</legend>${labels.map((label,i)=>`<label class="option"><input type="radio" name="answer" value="${i+1}" ${state.answers[state.q]===i+1?'checked':''}><span>${label}</span><span class="value" aria-hidden="true">0${i+1}</span></label>`).join('')}</fieldset><p class="note">요즘의 나에 가까운 쪽을 골라 주세요.<br>이전 질문으로 돌아가 답을 바꿔도 괜찮아요.</p><div class="quiz-bottom"><button class="primary" id="quiz-next" ${!state.answers[state.q]?'disabled':''}>${state.q===11?'나의 네 컷 담으러 가기':'다음 질문'} <span class="arrow">→</span></button></div>`,
 capture:()=>`${top('FOUR FRAMES OF YOU','quiz')}<span class="eyebrow">THE PHOTO BOOTH</span><h2>오늘의 나를,<br>네 장 안에.</h2><p class="intro">촬영하거나 사진을 골라 주세요.<br>각 사진을 누르면 얼굴 위치를 조절할 수 있어요.</p><div class="capture-stage ${state.photos.every(Boolean)&&!stream?'completed':''}" id="camera-stage">${stream?'<video id="video" autoplay playsinline muted></video><span class="camera-tag">FRONT CAMERA</span>':'<div class="capture-placeholder"><span class="viewfinder" aria-hidden="true">⌜ &nbsp; ⌝<br>⌞ &nbsp; ⌟</span>편하게, 당신의 모습 그대로.</div>'}<span class="counter" id="countdown" aria-live="polite"></span></div><div class="thumbs">${state.photos.map((photo,i)=>`<button class="thumb ${photo&&i===state.selected?'active':''}" data-slot="${i}" aria-label="${i+1}번째 사진 ${photo?'편집':'비어 있음'}">${photo?`<img src="${photo.url}" alt="${i+1}번째 선택 사진">`:`<span>0${i+1}</span>`}</button>`).join('')}</div><div class="photo-tools"><span id="shot-status" role="status">${state.photos.filter(Boolean).length} / 4 준비됨${state.sample?' · 샘플 그래픽':''}</span><button id="choose">사진에서 고르기 ↗</button></div>${state.photos[state.selected]&&state.editing?'<div class="crop-panel"><canvas id="crop" width="520" height="320" aria-label="선택한 사진 크롭 미리보기"></canvas><p class="note">끌어서 구도를 맞추거나 아래 조절기를 사용하세요.</p><label class="slider">확대<input id="zoom" type="range" min="1" max="3" step=".05" aria-label="사진 확대"></label><label class="slider">좌우<input id="pan-x" type="range" min="-1" max="1" step=".02" aria-label="사진 좌우 위치"></label><label class="slider">상하<input id="pan-y" type="range" min="-1" max="1" step=".02" aria-label="사진 상하 위치"></label><div class="photo-tools"><button id="replace">이 사진 바꾸기</button><button id="single-retake">이 컷 다시 촬영</button><button id="crop-reset">원래 구도</button></div><button class="secondary" id="crop-done">이 구도로 적용</button></div>':''}<div id="error" role="alert"></div><div class="actions">${primary(state.photos.every(Boolean)?'이 네 장으로 만들기':stream?'네 컷 촬영 시작 · 컷마다 3초':'카메라 켜기', 'capture-main')}${state.photos.every(Boolean)?'<button class="secondary" id="recapture">전체 다시 촬영</button>':''}<button class="secondary" id="sample">사진 없이 샘플 그래픽으로 체험</button></div><p class="note">JPG·PNG·WebP·HEIC(지원 기기), 각10MB·40MP 이하.<br>한 장만 고르면 네 칸에 반복해 넣어요. 사진은 로컬 처리되며 새로고침하면 사라져요.</p>`,
 reveal:()=>`${top('YOUR CONVERSATION NOTES','capture')}<span class="pill">DEMO · 실제 매칭이 아닙니다</span><div class="result-intro"><span class="result-icon" aria-hidden="true" style="display:block">✳</span><span class="eyebrow">A LITTLE MORE ABOUT YOU</span><h1>${p.title.replace(' 사람','<br>사람.')}</h1><p class="intro">누군가와의 궁합 대신,<br>당신이 편안해하는 대화의 모양을 발견했어요.${state.demoAnswers?'<br>현재 성향 설명은 샘플 응답 기준이에요.':''}${state.sample?'<br>사진 대신 샘플 그래픽을 사용하고 있어요.':''}</p></div><div class="profile-lines"><div class="profile-line"><b>PACE</b><span>${p.social}</span></div><div class="profile-line"><b>WORLD</b><span>${p.explore}</span></div><div class="profile-line"><b>DEPTH</b><span>${p.depth}</span></div><div class="profile-line"><b>TOPIC</b><span>${p.topics}</span></div></div><div class="quote">“요즘 가장 오래<br>이야기하고 싶은 건 뭐예요?”</div><p class="note">12개 응답을 5점 척도로 요약한 설명입니다. 검증된 심리검사·연애 성공 예측이 아니며 비교 상대나 일치율은 없어요.</p><div class="actions">${primary('나의 포토스트립 보기','make-strip')}</div>`,
 strip:()=>`${top('ONE POSSIBILITY, TO KEEP.','reveal')}<span class="eyebrow">YOUR FOUR FRAMES</span><h2>오늘의 우연, 네 컷.</h2><div class="strip-wrap" id="enlarge" role="button" tabindex="0" aria-label="포토스트립 크게 보기"><img src="${stripURL}" alt="본인의 흑백 사진 네 장과 성향 문구가 담긴 DEMO 포토스트립"></div><p class="strip-caption">눌러서 크게 보기 · DEMO / 실제 매칭 없음</p><div class="split-actions"><button class="primary" id="download">사진 저장 ↓</button><button class="secondary" id="share">공유 ↗</button></div><p class="note">아이폰에서는 이미지를 길게 눌러 저장하거나<br>공유 메뉴에서 ‘이미지 저장’을 선택할 수 있어요.</p>${primary('서울에서 만난다면?','waitlist')}<div class="center"><button class="text-button" data-go="capture">사진 구도 다시 조절하기</button></div>`,
 waitlist:()=>`${top('THE NEXT CHAPTER','strip')}<span class="eyebrow">SOMEDAY, IN SEOUL.</span><h1>화면 밖에서도,<br>만날 수 있다면.</h1><p class="intro">서울에서 이런 만남이 열린다면?<br>어떤 장소와 가격이 좋을지 골라보세요.</p><div class="ticket"><span class="eyebrow">PROTOTYPE ONLY</span><p>실제 사전예약 접수가 아닌 화면 체험이에요. 이메일·연락처를 받지 않으며 선택 내용도 서버에 보내지 않아요.</p></div><form id="waitlist-form" class="form"><label class="field">만나고 싶은 서울의 동네<select id="region">${regions.map(r=>`<option ${state.region===r?'selected':''}>${r}</option>`).join('')}</select></label><label class="field">이런 경험이라면, 희망 참가비<select id="price">${prices.map(r=>`<option ${state.price===r?'selected':''}>${r}</option>`).join('')}</select></label><button class="primary" type="submit">나의 체험 티켓 보기 <span class="arrow">↗</span></button></form><p class="note">확정된 행사·가격·좌석 예약이 없습니다.<br>실제 접수 기능은 다음 단계에서 준비합니다.</p>`,
 success:()=>`${top('UNTIL OUR NEXT ENCOUNTER','waitlist')}<div class="center"><div class="success-mark" aria-hidden="true">✳</div><span class="eyebrow">END OF THIS LITTLE STORY</span><h1>오늘의 우연은,<br>여기까지.</h1><p class="intro">나를 알아보는 작은 여정,<br>함께해 주셔서 고마워요.</p></div><div class="success-ticket"><span class="eyebrow">YOUR CONCEPT TICKET</span><h3>Missed Connections</h3><dl><dt>희망 동네</dt><dd>${state.region}</dd><dt>희망 가격</dt><dd>${state.price}</dd><dt>현재 상태</dt><dd>체험 완료 · 실제 신청 아님</dd></dl><div class="barcode" aria-hidden="true"></div><p class="note">NOT A RESERVATION / DEMO ONLY</p></div><div class="actions">${primary('내 사진으로 돌아가기','return-strip')}<button class="secondary" id="restart">기록 지우고 처음부터</button></div>`
 };
 app.innerHTML=screens[state.step]();
 document.title=`${state.step==='landing'?'어쩌면, 우리가 만났어야 할 이유.':'나의 네 컷'} — Missed Connections`;
 app.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{if(state.step==='quiz'&&el.dataset.go==='quiz'){state.q--;persist();render();app.focus();return}go(el.dataset.go)});
 app.querySelectorAll('[data-privacy]').forEach(el=>el.onclick=()=>document.getElementById('privacy').showModal());
 bind();
}
function bind(){const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
 on('start',()=>{state.quick=false;if(state.demoAnswers){state.answers=Array(12).fill(null);state.q=0;state.demoAnswers=false;}go('onboarding')});on('quick',()=>{state.quick=true;go('onboarding')});
 on('onboard-next',async()=>{if(!document.getElementById('adult').checked||!document.getElementById('local-agree').checked){showError('2개의 안내를 모두 확인해 주세요.');document.getElementById('adult').focus();return;}state.adult=true;persist();if(state.quick){state.demoAnswers=true;state.answers=[...sampleAnswers];persist();try{await loadSamples();go('reveal')}catch{showError('샘플을 준비하지 못했어요. 다시 눌러 주세요.')}}else go('quiz')});
 app.querySelectorAll('input[name="answer"]').forEach(el=>el.onchange=()=>{state.answers[state.q]=Number(el.value);invalidateStrip();persist();document.getElementById('quiz-next').disabled=false;});
 on('quiz-next',()=>{if(!state.answers[state.q])return;if(state.q<11){state.q++;persist();render();app.focus();window.scrollTo(0,0)}else go('capture')});
 on('choose',()=>pick(false));on('replace',()=>pick(true));on('single-retake',async()=>{singleRetake=true;const index=state.selected;if(!stream){await openCamera();singleRetake=true;}if(stream)await shoot(index);});
 on('capture-main',()=>state.photos.every(Boolean)?go('reveal'):stream?shoot():openCamera());
 on('recapture',()=>{if(confirm('네 컷을 모두 다시 촬영할까요?')){disposePhotos();state.sample=false;render();openCamera();}});
 on('sample',async()=>{if(state.photos.some(Boolean)&&!confirm('선택한 사진을 샘플 그래픽으로 바꿀까요?'))return;try{await loadSamples();render();}catch{showError('샘플을 준비하지 못했어요. 다시 시도해 주세요.')}});
 app.querySelectorAll('[data-slot]').forEach(el=>el.onclick=()=>{if(counting)return;state.selected=Number(el.dataset.slot);if(state.photos[state.selected]){state.editing=true;render();document.getElementById('crop').scrollIntoView({block:'nearest',behavior:'smooth'})}else pick(true);});
 on('crop-done',()=>{state.editing=false;render()});
 on('crop-reset',()=>{state.crops[state.selected]={zoom:1,x:0,y:0};invalidateStrip();setupCrop()});
 if(state.step==='capture'){if(stream){const video=document.getElementById('video');video.srcObject=stream;video.play().catch(()=>showError('카메라를 다시 켜거나 사진에서 골라 주세요.'));}setupCrop();}
 on('make-strip',()=>makeStrip());on('download',()=>download());on('share',()=>share());on('waitlist',()=>go('waitlist'));
 on('enlarge',()=>enlarge());const enlarged=document.getElementById('enlarge');if(enlarged)enlarged.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();enlarge()}};
 const form=document.getElementById('waitlist-form');if(form)form.onsubmit=e=>{e.preventDefault();state.region=document.getElementById('region').value;state.price=document.getElementById('price').value;go('success')};
 on('return-strip',()=>stripURL?go('strip'):makeStrip());on('restart',()=>{if(confirm('사진과 답변을 지우고 처음부터 시작할까요?'))clearAll();});
}
function showError(message){const el=document.getElementById('error');if(el){el.className='error';el.textContent=message;}else toast(message);}
function pick(single){if(counting)return;const input=document.getElementById('files');input.multiple=!single;input.dataset.single=single?'true':'false';input.value='';input.click();}
async function decode(blob){
 const originalURL=URL.createObjectURL(blob);let normalizedURL;
 try{
  const input=new Image();await new Promise((resolve,reject)=>{input.onload=resolve;input.onerror=reject;input.src=originalURL});
  if(input.naturalWidth*input.naturalHeight>40000000)throw Error('40MP 이하 사진을 골라 주세요.');
  const scale=Math.min(1,2048/Math.max(input.naturalWidth,input.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(input.naturalWidth*scale));canvas.height=Math.max(1,Math.round(input.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('사진을 처리할 메모리가 부족해요. 작은 사진을 골라 주세요.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(input,0,0,canvas.width,canvas.height);
  const normalized=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!normalized)throw Error('사진을 처리하지 못했어요.');
  input.src='';normalizedURL=URL.createObjectURL(normalized);const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=normalizedURL});
  return {image,url:normalizedURL,blob:normalized};
 }catch(err){if(normalizedURL)URL.revokeObjectURL(normalizedURL);throw err;}finally{URL.revokeObjectURL(originalURL);}
}
async function loadSamples(){stopCamera();const photos=[];try{for(let i=0;i<4;i++)photos.push(await decode(new Blob([sampleSVG(i)],{type:'image/svg+xml'})));}catch(err){photos.forEach(p=>URL.revokeObjectURL(p.url));throw err;}disposePhotos();state.photos=photos;state.sample=true;state.selected=0;state.editing=false;}
async function ingest(files,single){
 if(!files.length)return;if(files.length>4){showError('한 번에 최대 4장까지 골라 주세요.');return;}
 const version=sequence,prepared=[];try{for(const file of files){if(file.size>10*1024*1024)throw Error('사진 한 장은 10MB 이하여야 해요.');if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw Error('JPG·PNG·WebP 사진을 골라 주세요. HEIC는 기기 지원이 필요해요.');try{prepared.push(await decode(file));}catch(err){throw Error(err instanceof Error&&err.message?err.message:'이 사진을 읽지 못했어요. HEIC라면 JPG로 바꿔서 골라 주세요.');}}
 if(state.step!=='capture'||sequence!==version){prepared.forEach(p=>URL.revokeObjectURL(p.url));return;}
 const indexes=single?[state.selected]:files.length===1?[0,1,2,3]:files.map((_,i)=>i);
 // Each slot owns its URL independently; replacing one must not invalidate other slots.
 const assigned=[];for(let j=0;j<indexes.length;j++){const source=prepared[files.length===1?0:j];const image=source.image;const blob=source.blob;assigned.push({index:indexes[j],photo:{image,url:URL.createObjectURL(blob),blob}});}
 for(const {index,photo} of assigned){if(state.photos[index])URL.revokeObjectURL(state.photos[index].url);state.photos[index]=photo;state.crops[index]={zoom:1,x:0,y:0};}
 prepared.forEach(p=>URL.revokeObjectURL(p.url));state.sample=false;state.editing=single;invalidateStrip();render();toast(files.length===1&&!single?'한 장을 네 칸에 넣었어요. 칸마다 구도를 바꿀 수 있어요.':'사진을 준비했어요. 구도를 조절해 보세요.');
 }catch(err){prepared.forEach(p=>URL.revokeObjectURL(p.url));showError(err.message||'사진을 읽지 못했어요. JPG로 다시 골라 주세요.');}
}
document.getElementById('files').onchange=e=>ingest([...e.target.files],e.target.dataset.single==='true');
async function openCamera(){if(counting)return;stopCamera();const token=sequence;if(!navigator.mediaDevices?.getUserMedia){showError('보안 연결의 Safari에서 열거나 사진에서 골라 주세요.');return;}
 const button=document.getElementById('capture-main');if(button){button.disabled=true;button.textContent='카메라 권한을 기다리는 중…';}
 try{const incoming=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1920},height:{ideal:1080}},audio:false});if(state.step!=='capture'||token!==sequence){incoming.getTracks().forEach(t=>t.stop());return;}stream=incoming;render();}
 catch(err){if(state.step!=='capture'||token!==sequence)return;const message={NotAllowedError:'카메라 권한이 꺼져 있어요. 브라우저 설정을 확인하거나 사진에서 골라 주세요.',NotFoundError:'사용할 카메라가 없어요. 사진에서 골라 주세요.',NotReadableError:'다른 앱에서 카메라를 사용 중일 수 있어요. 닫은 뒤 다시 시도해 주세요.'};showError(message[err.name]||'카메라를 켜지 못했어요. Safari에서 열거나 사진에서 골라 주세요.');if(button){button.disabled=false;button.textContent='카메라 다시 켜기';}}
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function shoot(onlyIndex){if(counting||!stream)return;const video=document.getElementById('video');if(!video?.videoWidth){toast('카메라가 준비되면 다시 눌러 주세요.');return;}const token=sequence;counting=true;const indices=Number.isInteger(onlyIndex)?[onlyIndex]:[0,1,2,3];const button=document.getElementById('capture-main');if(button)button.disabled=true;
 try{for(const i of indices){for(let n=3;n>0;n--){if(token!==sequence)return;document.getElementById('countdown').textContent=String(n);await wait(1000);}if(token!==sequence)return;document.getElementById('countdown').textContent='';const canvas=document.createElement('canvas');const scale=Math.min(1,1920/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(!blob)throw Error('촬영 이미지를 만들지 못했어요.');const photo=await decode(blob);if(token!==sequence){URL.revokeObjectURL(photo.url);return;}if(state.photos[i])URL.revokeObjectURL(state.photos[i].url);state.photos[i]=photo;state.crops[i]={zoom:1,x:0,y:0};state.sample=false;state.selected=i;invalidateStrip();document.getElementById('shot-status').textContent=`${i+1}번째 사진을 담았어요`;const stage=document.getElementById('camera-stage');stage.classList.remove('flash');void stage.offsetWidth;stage.classList.add('flash');await wait(900);}
 if(token===sequence){stopCamera();render();toast('사진을 담았어요. 칸마다 구도를 조절해 보세요.');}
 }catch(err){if(token===sequence){stopCamera();render();showError(err.message||'촬영이 중단됐어요. 다시 시도해 주세요.');}}
 finally{if(token===sequence){counting=false;if(button)button.disabled=false;}}
}
function drawPhoto(ctx,photo,crop,x,y,w,h){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();const img=photo.image;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)*crop.zoom;const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,x+(w-dw)/2+crop.x*(dw-w)/2,y+(h-dh)/2+crop.y*(dh-h)/2,dw,dh);ctx.restore();}
function monochrome(ctx,w,h){const pixels=ctx.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4){const y=Math.round(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2]);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=y;}ctx.putImageData(pixels,0,0);}
function setupCrop(){const canvas=document.getElementById('crop');if(!canvas)return;const c=state.crops[state.selected];const refresh=()=>{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,520,320);drawPhoto(ctx,state.photos[state.selected],c,0,0,520,320);monochrome(ctx,520,320);};
 for(const [id,key] of [['zoom','zoom'],['pan-x','x'],['pan-y','y']]){const input=document.getElementById(id);input.value=c[key];input.oninput=()=>{c[key]=Number(input.value);invalidateStrip();refresh()};}
 let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,cx:c.x,cy:c.y};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;const rect=canvas.getBoundingClientRect();const img=state.photos[state.selected].image;const scale=Math.max(520/img.naturalWidth,320/img.naturalHeight)*c.zoom;const dx=(img.naturalWidth*scale-520)*rect.width/520,dy=(img.naturalHeight*scale-320)*rect.height/320;c.x=Math.max(-1,Math.min(1,drag.cx+(dx>1?(e.clientX-drag.x)*2/dx:0)));c.y=Math.max(-1,Math.min(1,drag.cy+(dy>1?(e.clientY-drag.y)*2/dy:0)));document.getElementById('pan-x').value=c.x;document.getElementById('pan-y').value=c.y;invalidateStrip();refresh();};canvas.onpointerup=()=>drag=null;canvas.onpointercancel=()=>drag=null;refresh();}
async function prepareFont(){let timer;try{await Promise.race([Promise.all([document.fonts.load('20px MCSerif'),document.fonts.ready]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('font timeout')),8000)})]);}finally{clearTimeout(timer);}}
async function makeStrip(){if(!state.photos.every(Boolean)){go('capture');return;}stopCamera();invalidateStrip();const version=renderVersion;app.innerHTML='<div class="processing" role="status"><div class="spinner" aria-hidden="true"></div><span class="eyebrow">IN THE DARKROOM</span><h2>네 장의 순간을,<br>한 장의 기록으로.</h2><p>흑백으로 현상하고 글씨를 얹고 있어요.</p></div>';app.focus();
 try{await prepareFont();await wait(500);if(version!==renderVersion)return;const canvas=document.createElement('canvas');canvas.width=600;canvas.height=1800;const ctx=canvas.getContext('2d');ctx.fillStyle='#fbf9f2';ctx.fillRect(0,0,600,1800);state.photos.forEach((photo,i)=>drawPhoto(ctx,photo,state.crops[i],40,180+340*i,520,320));monochrome(ctx,600,1800);ctx.fillStyle='#252821';ctx.textAlign='center';ctx.font='italic 38px Georgia';ctx.fillText('Missed Connections',300,80);ctx.font='13px monospace';ctx.fillText('FOUR FRAMES. ONE POSSIBILITY.',300,115);ctx.font='25px MCSerif,serif';ctx.fillText(profile().title,300,1595);ctx.font='14px monospace';ctx.fillText(new Date().toLocaleDateString('sv-SE')+' / SEOUL',300,1640);ctx.font='italic 23px Georgia';ctx.fillText('Somewhere between us.',300,1704);ctx.font='14px sans-serif';ctx.fillText('DEMO · 실제 매칭 없음'+(state.sample?' · 샘플 그래픽':''),300,1750);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(version!==renderVersion)return;if(!blob)throw Error('PNG를 만들지 못했어요.');stripBlob=blob;stripURL=URL.createObjectURL(blob);go('strip');}
 catch{if(version===renderVersion){render();showError('사진을 현상하지 못했어요. 다시 시도해 주세요.');}}
}
function download(){if(!stripBlob)return;const link=document.createElement('a');link.href=stripURL;link.download='missed-connections-demo.png';link.click();toast('저장을 요청했어요. 아이폰에서는 공유 메뉴도 이용해 보세요.');}
async function share(){if(!stripBlob)return;const file=new File([stripBlob],'missed-connections-demo.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:'Missed Connections · DEMO'});}catch(err){if(err.name!=='AbortError')toast('파일 공유가 어려워요. 사진 저장을 이용해 주세요.');}}else{download();toast('이 브라우저는 파일 공유 대신 사진 저장을 지원해요.');}}
function enlarge(){const dialog=document.createElement('dialog');dialog.className='lightbox';dialog.innerHTML=`<div class="lightbox-tools"><span class="eyebrow" style="margin:0">YOUR FOUR FRAMES / DEMO</span><div><button id="zoom-strip" aria-label="사진 확대">확대 ＋</button><button id="close-strip" aria-label="확대 보기 닫기">닫기 ×</button></div></div><img src="${stripURL}" alt="확대한 포토스트립"><p>이미지를 길게 누르거나 기기의 확대 기능으로 살펴보세요.</p>`;document.body.append(dialog);dialog.querySelector('#close-strip').onclick=()=>dialog.close();dialog.querySelector('#zoom-strip').onclick=()=>{const zoomed=dialog.classList.toggle('zoomed');dialog.querySelector('#zoom-strip').textContent=zoomed?'전체 보기 －':'확대 ＋';};dialog.onclose=()=>dialog.remove();dialog.showModal();}
document.getElementById('global-reset').onclick=()=>{if(confirm('현재 사진과 답변을 지우고 처음부터 시작할까요?'))clearAll();};
document.getElementById('close-privacy').onclick=()=>document.getElementById('privacy').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.step==='capture'){stopCamera();render();}});window.addEventListener('pagehide',stopCamera);
// Never restore a fabricated successful submission or photo from a public URL.
go(location.hash.slice(1)||'landing',true);

})();
