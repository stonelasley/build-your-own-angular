'use strict';

var _ = require('lodash');

function createPredicateFn(expression) {

  function comparator(actual, expected) {

    actual = actual.toLowerCase();
    expected = expected.toLowerCase();
    return actual.indexOf(expected) !== -1;
  }

  function deepCompare(actual, expected, comparator) {

    console.info('actual', actual);
    console.info('expected', expected);
    console.info('comparator', comparator);
    if (_.isObject(actual)) {

      return _.some(actual, function (value) {

        return comparator(value, expected);
      });
    } else {

      return comparator(actual, expected);
    }
  }

  return function predicateFn(item) {

    return deepCompare(item, expression, comparator);
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