'use strict';

var filters = {};

function filter(name) {

  return filters[name];
}

function register(name, factory) {

  var filter = factory();
  filters[name] = filter;

  return filter;
}

module.exports = {register: register, filter: filter};