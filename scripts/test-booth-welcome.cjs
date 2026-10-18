const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const file = path.resolve(__dirname, '../app/components/BoothPhotoWall.tsx')
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const component = new Module(file)
component.filename = file
component.paths = Module._nodeModulePaths(path.dirname(file))
const nativeRequire = Module.createRequire(path.resolve(__dirname, '../package.json'))
function loadTs(file) {
 const m=new Module(file);m.filename=file;m.paths=component.paths
 m.require=id=>id.startsWith('@/')?loadTs(path.resolve(__dirname,'..',id.slice(2))+'.ts'):id.startsWith('./')?loadTs(path.resolve(path.dirname(file),id)+'.ts'):nativeRequire(id)
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file)
 return m.exports
}
component.require=id=>id.startsWith('@/')?loadTs(path.resolve(__dirname,'..',id.slice(2))+'.ts'):nativeRequire(id)
component._compile(compiled, file)
const Wall = component.exports.default
const gallery = renderToStaticMarkup(React.createElement(Wall, { slug: 'qa', initialImageUrls: ['/one.png', '/two.png', '/one.png'], initialSamplesOnly: true }))
if ((gallery.match(/<img /g) || []).length !== 2 || !gallery.includes('booth-photo-wall') || gallery.includes('booth-welcome-layout') || gallery.includes('<svg') || gallery.includes('booth-spinner')) throw Error('Welcome must immediately show only the unique registered previews')
const empty = renderToStaticMarkup(React.createElement(Wall, { slug: 'qa' }))
if (empty.includes('<img') || empty.includes('<svg') || !empty.includes('미리보기를 불러오고 있어요')) throw Error('No single-frame placeholder while waiting for recent photos')
console.log('Welcome first render: gallery immediately, duplicate URLs removed, empty gallery waits without a single-frame flash.')
