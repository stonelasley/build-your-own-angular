'use strict';

var _ = require('lodash');

function createPredicateFn(expression) {

  function comparator(actual, expected) {

    if (_.isUndefined(actual)) {

      return false;
    }
    if (_.isNull(actual) || _.isNull(expected)) {

      return actual === expected;
    }
    actual = ('' + actual).toLowerCase();
    expected = ('' + expected).toLowerCase();
    return actual.indexOf(expected) !== -1;
  }

  function deepCompare(actual, expected, comparator) {

    if (_.isString(expected) && _.startsWith(expected, '!')) {

      return !deepCompare(actual, expected.substring(1), comparator);
    }
    if (_.isArray(actual)) {

      return _.any(actual, function (actualItem) {

        return deepCompare(actualItem, expected, comparator)
      });
    }
    if (_.isObject(actual)) {

      if (_.isObject(expected)) {

        return _.every(_.toPlainObject(expected), function (expectedVal, expectedKey) {

          if (_.isUndefined(expectedVal)) {
            return true;
          }
          return deepCompare(actual[expectedKey], expectedVal, comparator);
        });
      } else {

        return _.some(actual, function (value) {

          return deepCompare(value, expected, comparator);
        });
      }
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
    } else if (_.isString(filterExpr) ||
      _.isNumber(filterExpr) ||
      _.isBoolean(filterExpr) ||
      _.isNull(filterExpr) ||
      _.isObject(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr);
    } else {
      return array;
    }

    return _.filter(array, predicateFn);
  };
}

module.exports = filterFilter;