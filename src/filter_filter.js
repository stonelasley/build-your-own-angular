'use strict';

var _ = require('lodash');

function createPredicateFn(expression) {

  return function predicateFn(item) {

    return item === expression;
  };
}

function filterFilter() {

  return function (array, filterExpr) {

    var predicateFn;

    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    } else if (_.isString(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr);
    } else {
      return array;
    }

    return _.filter(array, predicateFn);
  };
}

module.exports = filterFilter;