var _ = require('lodash');

module.exports = function sayhello(to) {
  return _.template("Hello, <%= name %>!")({name: to});
};