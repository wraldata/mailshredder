// some random crap here

let TestModule = function (options) {
  let _membervar = 'foo'

  this.options = options
  this.a = 1

  function foo () {
    return 'bar'
  }

  console.log(foo)
  console.log(_membervar)
}

module.exports = TestModule
