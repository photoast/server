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
component._compile(compiled, file)
const Wall = component.exports.default
const gallery = renderToStaticMarkup(React.createElement(Wall, { slug: 'qa', initialImageUrls: ['/one.png', '/two.png', '/one.png'], initialSamplesOnly: true }))
if ((gallery.match(/<img /g) || []).length !== 2 || !gallery.includes('booth-photo-wall') || gallery.includes('booth-welcome-layout') || gallery.includes('<svg') || gallery.includes('booth-spinner')) throw Error('Welcome must immediately show only the unique registered previews')
const empty = renderToStaticMarkup(React.createElement(Wall, { slug: 'qa' }))
if (empty.includes('<img') || empty.includes('<svg') || !empty.includes('미리보기를 불러오고 있어요')) throw Error('No single-frame placeholder while waiting for recent photos')
console.log('Welcome first render: gallery immediately, duplicate URLs removed, empty gallery waits without a single-frame flash.')
