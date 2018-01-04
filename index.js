var cheerio = require('cheerio')
var CleanCSS = require('clean-css')
var autoprefixer = require('autoprefixer')
var postcss = require('postcss')
var babel = require("babel-core")
var css = require('css')
var path = require('path')
var fs = require('fs')
var postcssModules = require('postcss-modules')
var through = require('through2')

module.exports = function(content) {
  this.cacheable()

  var callback = this.async()
  var $ = cheerio.load(content)
  var _result = ''

  function htmlToJs($, fp) {
    var uuid = (+new Date()).toString(36)
    var style = $('style').html() || ''
    var template = $('template').html() || ''
    var script = $('script:not([require-src])').html() || ''
    var replaceMap = {}
  
    if ($('style').attr('scoped')) {
      var prefix = `[${uuid}] `
      var ast = css.parse(style)
      var rules = ast.stylesheet.rules
      var arr = []
      rules.forEach(rule => {
        if (rule.type === 'import') {
          // var filePath = path.parse(fp)
          // var importPath = path.parse(rule.import)
          // var map = fs.readFileSync(path.join(filePath.dir, importPath.dir, importPath.name + '.css'), 'utf-8')
          // if (map) {
          //   var _rules = css.parse(map).stylesheet.rules
          //   _rules.forEach(_rule => {
          //     if (_rule.selectors) {
          //       _rule.selectors.forEach((selector, i) => {
          //         _rule.selectors[i] = prefix + selector
          //       })
          //     }
          //     arr.push(_rule)
          //   })
          //   // Object.assign(replaceMap, JSON.parse(map))
          // }
        } else {
          rule.selectors.forEach((selector, i) => {
            rule.selectors[i] = prefix + selector
          })
        }
      })
      // rules.push.apply(rules, arr)
      // console.log(1111111111, rules)
      // console.log(2222222222, arr)
      style = css.stringify(ast)
    }
  
    function renameClass(source, map) {
      return source
        .replace(/<!--[^>]*>/g, '')
        .trim()
        .replace(/[\t\r ]+/g, ' ')
        .replace(/>[\t\n\r ]+</g, '><')
        .replace(/class="(.+?)"/g, function (match, key){
          return `class="${key.trim().split(/\s+/).map(item => map[item] || item).join(' ')}"`
        })
    }

    postcss([
      autoprefixer,
      postcssModules({
        generateScopedName: '[hash:base64:5]',
        getJSON (cssFileName, json) {
          Object.assign(replaceMap, json)
        }
      })
    ])
    .process(style)
    .then(result => {
      var exports = {
        uuid: uuid,
        styl: new CleanCSS().minify(result.css).styles || undefined,
        tpl: renameClass(template, replaceMap) || undefined
      }
      var match = script.match(/\s*document\.registerElement\s*\(\s*['"]{1}([a-zA-Z\-]+)['"]{1}(\s*,\s*\{\s*((.|\s)*)\s*\})*\s*\)/)
      var name = 'lvm'
      var proto = ''
      if (match) {
        name = match[1] || name
        proto = match[3] || proto
      }      
      _result = `LVM.component("${name}", ${JSON.stringify(exports)}${proto ? ", {" + proto + "}" : ""})`
      _result = babel.transform(_result, {
        presets: ['es2015']
      }).code
      callback(null, _result)
    })
  }

  htmlToJs($, this.resourcePath)
}
