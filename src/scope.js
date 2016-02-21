'use strict';

var _ = require('lodash');
var parse = require('./parse');

function initWatchVal() {
}

function Scope() {
  this.$root = this;
  this.$$applyAsyncId = null;
  this.$$applyAsyncQueue = [];
  this.$$asyncQueue = [];
  this.$$children = [];
  this.$$phase = null;
  this.$$lastDirtyWatch = null;
  this.$$listeners = {};
  this.$$postDigestQueue = [];
  this.$$watchers = [];
}

Scope.prototype.$apply = function (expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$root.$digest();
  }
};

Scope.prototype.$applyAsync = function (expr) {
  var self = this;

  self.$$applyAsyncQueue.push(function () {
    self.$eval(expr);
  });
  if (self.$root.$$applyAsyncId === null) {
    self.$root.$$applyAsyncId = setTimeout(function () {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$beginPhase = function (phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress';
  }
  this.$$phase = phase;
};

Scope.prototype.$broadcast = function (eventName) {

  var event = {
    name: eventName,
    targetScope: this,
    preventDefault: function () {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));

  this.$$everyScope(function (scope) {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    event.currentScope = null;
    return true;
  });

  return event;
};

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};

Scope.prototype.$destroy = function () {

  this.$broadcast('$destroy');
  if (this.$parent) {
    var siblings = this.$parent.$$children;
    var indexOfThis = siblings.indexOf(this);
    if (indexOfThis >= 0) {
      siblings.splice(indexOfThis, 1);
    }
  }
  this.$$watchers = null;
  this.$$listeners = {};
};

Scope.prototype.$digest = function () {

  var ttl = 10;
  var dirty;
  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  do {

    while (this.$$asyncQueue.length) {
      try {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch (e) {
        console.error(e);
      }
    }

    dirty = this.$$digestOnce();

    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      this.$clearPhase();
      throw "10 digest iterations reached";
    }

  } while (dirty || this.$$asyncQueue.length);
  this.$clearPhase();

  while (this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
};

Scope.prototype.$emit = function (eventName) {

  var propagationStopped = false;
  var event = {
    name: eventName,
    targetScope: this,
    stopPropagation: function () {
      propagationStopped = true;
    },
    preventDefault: function () {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));
  var scope = this;

  do {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while (scope && !propagationStopped);
  event.currentScope = null;
  return event;
};

Scope.prototype.$eval = function (expr, locals) {
  return parse(expr)(this, locals);
};

Scope.prototype.$evalAsync = function (expr) {
  var self = this;

  if (!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function () {
      if (self.$$asyncQueue.length) {
        self.$root.$digest();
      }
    }, 0);
  }
  this.$$asyncQueue.push({scope: this, expression: expr});
};

Scope.prototype.$new = function (isolated, parent) {

  var child;
  parent = parent || this;
  if (isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  } else {
    var ChildScope = function () {
    };
    ChildScope.prototype = this;
    child = new ChildScope();
  }
  child.$$watchers = [];
  child.$$listeners = {};
  child.$$children = [];
  child.$parent = parent;
  parent.$$children.push(child);

  return child;
};

Scope.prototype.$on = function (eventName, listener) {

  var listeners = this.$$listeners[eventName];

  if (!listeners) {
    this.$$listeners[eventName] = listeners = [];
  }
  listeners.push(listener);
  return function () {
    var index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners[index] = null;
    }
  };
};

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
  var self = this;

  watchFn = parse(watchFn);

  if (watchFn.$$watchDelegate) {
    return watchFn.$$watchDelegate(self, listenerFn, valueEq, watchFn);
  }

  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function () {
    },
    valueEq: !!valueEq,
    last: initWatchVal
  };

  self.$$watchers.unshift(watcher);
  this.$root.$$lastDirtyWatch = null;

  return function () {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$root.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$watchCollection = function (watchFn, listenerFn) {

  var self = this;
  var newValue;
  var oldValue;
  var oldLength;
  var veryOldValue;
  var trackVeryOldValue = (listenerFn.length > 1);
  var changeCount = 0;
  var firstRun = true;

  watchFn = parse(watchFn);

  var internalWatchFn = function (scope) {

    var newLength;
    newValue = watchFn(scope);

    if (_.isObject(newValue)) {

      if (isArrayLike(newValue)) {

        if (!_.isArray(oldValue)) {

          changeCount++;
          oldValue = [];
        }
        if (newValue.length !== oldValue.length) {
          changeCount++;
          oldValue.length = newValue.length;
        }

        _.forEach(newValue, function (newItem, i) {

          var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
          if (!bothNaN && newItem !== oldValue[i]) {
            changeCount++;
            oldValue[i] = newItem;
          }
        });
      } else {

        if (!_.isObject(oldValue) || isArrayLike(oldValue)) {
          changeCount++;
          oldValue = {};
          oldLength = 0;
        }
        newLength = 0;
        _.forOwn(newValue, function (newVal, key) {

          newLength++;
          if (oldValue.hasOwnProperty(key)) {
            var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
            if (!bothNaN && oldValue[key] !== newVal) {
              changeCount++;
              oldValue[key] = newVal;
            }
          } else {
            changeCount++;
            oldLength++;
            oldValue[key] = newVal;
          }
        });

        if (oldLength > newLength) {
          changeCount++;
          _.forOwn(oldValue, function (oldVal, key) {
            if (!newValue.hasOwnProperty(key)) {
              oldLength--;
              delete oldValue[key];
            }
          });
        }
      }
    } else {

      if (!self.$$areEqual(newValue, oldValue, false)) {
        changeCount++;
      }
      oldValue = newValue;
    }

    return changeCount;
  };

  var internalListenerFn = function () {
    if (firstRun) {
      listenerFn(newValue, newValue, self);
      firstRun = false;
    } else {
      listenerFn(newValue, veryOldValue, self);
    }

    if (trackVeryOldValue) {
      veryOldValue = _.clone(newValue);
    }
  };

  return this.$watch(internalWatchFn, internalListenerFn);
};

Scope.prototype.$watchGroup = function (watchFns, listenerFn) {
  var self = this;

  var newValues = new Array(watchFns.length);
  var oldValues = new Array(watchFns.length);
  var changeReactionScheduled = false;
  var firstRun = true;

  if (watchFns.length === 0) {
    var shouldCall = true;
    self.$evalAsync(function () {
      if (shouldCall) {
        listenerFn(newValues, newValues, self);
      }
    });
    return function () {
      shouldCall = false;
    };
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }

    changeReactionScheduled = false;
  }

  var destroyFunctions = _.map(watchFns, function (watchFn, i) {
    return self.$watch(watchFn, function (newValue, oldValue) {
      newValues[i] = newValue;
      oldValues[i] = oldValue;

      if (!changeReactionScheduled) {
        changeReactionScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    });
  });

  return function () {
    _.forEach(destroyFunctions, function (destroyFunction) {
      destroyFunction();
    });
  };
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {

  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' &&
      isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$$digestOnce = function () {
  var self = this;

  var dirty;
  var continueLoop = true;

  this.$$everyScope(function (scope) {

    var newValue, oldValue;

    _.forEachRight(scope.$$watchers, function (watcher) {
      try {
        if (watcher) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;

          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            scope.$root.$$lastDirtyWatch = watcher;
            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue,
              (oldValue === initWatchVal ? newValue : oldValue),
              scope);
            dirty = true;
          } else if (scope.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            return false;
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

    return continueLoop;
  });

  return dirty;
};

Scope.prototype.$$everyScope = function (fn) {
  if (fn(this)) {
    return this.$$children.every(function (child) {
      return child.$$everyScope(fn);
    });
  } else {
    return false;
  }
};

Scope.prototype.$$fireEventOnScope = function (eventName, listenerArgs) {

  var listeners = this.$$listeners[eventName] || [];
  var i = 0;

  while (i < listeners.length) {
    if (listeners[i] === null) {
      listeners.splice(i, 1);
    } else {
      try {
        listeners[i].apply(null, listenerArgs);
      } catch (e) {
        console.log(e);
      }
      i++;
    }
  }
  return event;
};

Scope.prototype.$$flushApplyAsync = function () {

  while (this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }

  this.$root.$$applyAsyncId = null;

};

Scope.prototype.$$postDigest = function (fn) {
  this.$$postDigestQueue.push(fn);
};

function isArrayLike(obj) {
  if (_.isNull(obj) || _.isUndefined(obj)) {
    return false;
  }
  var length = obj.length;
  return (_.isNumber(length) && length > 0 && (length - 1) in obj);
}

module.exports = Scope;