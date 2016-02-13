'use strict';

var filter = require('../src/filter').filter;

describe('filter filter', function () {

  beforeEach(function () {
    //runs before each spec
  });

  it('is available', function () {

    expect(filter('filter')).toBeDefined();
  });
});