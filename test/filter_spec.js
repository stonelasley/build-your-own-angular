'use strict';

var register = require('../src/filter').register;
var filter = require('../src/filter').filter;

describe('filter', function () {

  beforeEach(function () {
    //runs before each spec
  });

  it('can be registered and obtained', function () {

    var myFilter = function () {
    };
    var myFilterFactory = function () {

      return myFilter;
    };

    register('my', myFilterFactory);
    expect(filter('my')).toBe(myFilter);
  });
});