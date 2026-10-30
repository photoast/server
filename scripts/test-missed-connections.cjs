/* Local tests against the shipped static functions; no browser, DB or external API. */
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync('public/missed-connections/assets/app.js', 'utf8')
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))

const profileSource = extract('function profile()', 'function sampleSVG(')
const ctx = {state: {answers: Array(12).fill(3)}}
vm.createContext(ctx)
vm.runInContext(profileSource, ctx)
assert.equal(ctx.profile().title, '자기만의 속도로 만나는 사람')
ctx.state.answers = [5,1,1,5,1,5,1,1,5,1,1,1]
const p = ctx.profile()
assert.equal(p.title, '새로움에 마음을 여는 사람')
assert.match(p.social, /먼저 대화를/)
assert.match(p.depth, /가벼운 일상/)
assert.equal(p.topics, '새로운 대화 소재')

const graySource = extract('function monochrome(', 'function setupCrop(')
const grayContext = {}
vm.createContext(grayContext)
vm.runInContext(graySource, grayContext)
const pixels = {data: new Uint8ClampedArray([255,0,0,123,255,255,255,255,0,0,0,0])}
grayContext.monochrome({getImageData:()=>pixels,putImageData:()=>{}},3,1)
assert.deepEqual([...pixels.data], [54,54,54,123,255,255,255,255,0,0,0,0])

const drawSource = extract('function drawPhoto(', 'function monochrome(')
const drawContext = {}; vm.createContext(drawContext); vm.runInContext(drawSource,drawContext)
let drawArgs
const painter={save(){},beginPath(){},rect(){},clip(){},restore(){},drawImage(...args){drawArgs=args}}
drawContext.drawPhoto(painter,{image:{naturalWidth:1000,naturalHeight:1000}},{zoom:1,x:0,y:1},40,180,520,320)
assert.deepEqual(drawArgs.slice(1),[40,180,520,520]) // pan to the boundary without exposing blank pixels

async function testLateCamera() {
 let resolveMedia, stopped=0, renders=0
 const cameraContext={sequence:0,counting:false,singleRetake:false,stream:null,state:{step:'capture'},document:{getElementById:()=>({disabled:false,textContent:''})},navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMedia=r)}},render:()=>renders++,showError:()=>assert.fail('unexpected camera error')}
 vm.createContext(cameraContext)
 vm.runInContext(extract('function stopCamera()', 'function invalidateStrip()')+extract('async function openCamera()', 'const wait='),cameraContext)
 const pending=cameraContext.openCamera()
 cameraContext.state.step='landing'
 resolveMedia({getTracks:()=>[{stop:()=>stopped++}]})
 await pending
 assert.equal(stopped,1)
 assert.equal(renders,0)
 assert.equal(cameraContext.stream,null)
}

const settingsContext={};vm.createContext(settingsContext)
vm.runInContext(extract('const connectionChoices=', 'const sampleAnswers='),settingsContext)
for(const scope of ['name','phone'])for(const duration of ['week','month','year'])for(const mood of ['calm','bright','free'])for(const notification of ['none','alimtalk']){
 const selected={scope,duration,mood,notification}
 assert.deepEqual(JSON.parse(JSON.stringify(settingsContext.normalizeConnectionPreferences(selected))),selected)
}
assert.equal(settingsContext.normalizeConnectionPreferences(null),null)
assert.equal(settingsContext.normalizeConnectionPreferences({scope:'phone',duration:'forever',mood:'bright',notification:'alimtalk'}),null)
assert.equal(settingsContext.normalizeConnectionPreferences({scope:'name',duration:'week',mood:'bright',notification:'app'}),null)
const privateInput={scope:'phone',duration:'month',mood:'calm',notification:'alimtalk',phone:'NOT_A_REAL_NUMBER',name:'TEST_ONLY'}
assert.deepEqual(Object.keys(settingsContext.normalizeConnectionPreferences(privateInput)).sort(),['duration','mood','notification','scope'])

assert(!/\b(fetch|XMLHttpRequest|sendBeacon)\s*\(/.test(source),'local prototype must not transmit photos or responses')
testLateCamera().then(()=>console.log('PASS: 36 preference combinations, rejected app/invalid options, no contact retention, profile/reverse items, grayscale, crop, late camera cleanup, local-only boundary')).catch(err=>{console.error(err);process.exitCode=1})
