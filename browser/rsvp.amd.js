define(
  ["exports"],
  function(__exports__) {
    "use strict";
    var config = {};

    var browserGlobal = (typeof window !== 'undefined') ? window : {};

    var MutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
    var RSVP;

    if (typeof process !== 'undefined' &&
      {}.toString.call(process) === '[object process]') {
      config.async = function(callback, binding) {
        process.nextTick(function() {
          callback.call(binding);
        });
      };
    } else if (MutationObserver) {
      var queue = [];

      var observer = new MutationObserver(function() {
        var toProcess = queue.slice();
        queue = [];

        toProcess.forEach(function(tuple) {
          var callback = tuple[0], binding = tuple[1];
          callback.call(binding);
        });
      });

      var element = document.createElement('div');
      observer.observe(element, { attributes: true });

      // Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
      window.addEventListener('unload', function(){
        observer.disconnect();
        observer = null;
      });

      config.async = function(callback, binding) {
        queue.push([callback, binding]);
        element.setAttribute('drainQueue', 'drainQueue');
      };
    } else {
      config.async = function(callback, binding) {
        setTimeout(function() {
          callback.call(binding);
        }, 1);
      };
    }

    function configure(name, value) {
      config[name] = value;
    }


    //This embeds Backbone.Events as the event tracking system.
    //It needs a few shims first though.
    var slice = [].slice;
    var _ = {};

    //This is copied from Underscore.js 1.4.3, unmodified.
    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = function(func) {
      var ran = false, memo;
      return function() {
        if (ran) return memo;
        ran = true;
        memo = func.apply(this, arguments);
        func = null;
        return memo;
      };
    };

    // This is copied from Backbone 0.9.9.  The only modification was to remove
    //Backbone.Events = in the line defining the Events object.
      // Backbone.Events
      // ---------------

      // Regular expression used to split event strings.
      var eventSplitter = /\s+/;

      // Implement fancy features of the Events API such as multiple event
      // names `"change blur"` and jQuery-style event maps `{change: action}`
      // in terms of the existing API.
      var eventsApi = function(obj, action, name, rest) {
        if (!name) return true;
        if (typeof name === 'object') {
          for (var key in name) {
            obj[action].apply(obj, [key, name[key]].concat(rest));
          }
        } else if (eventSplitter.test(name)) {
          var names = name.split(eventSplitter);
          for (var i = 0, l = names.length; i < l; i++) {
            obj[action].apply(obj, [names[i]].concat(rest));
          }
        } else {
          return true;
        }
      };

      // Optimized internal dispatch function for triggering events. Tries to
      // keep the usual cases speedy (most Backbone events have 3 arguments).
      var triggerEvents = function(obj, events, args) {
        var ev, i = -1, l = events.length;
        switch (args.length) {
        case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx);
        return;
        case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, args[0]);
        return;
        case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, args[0], args[1]);
        return;
        case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, args[0], args[1], args[2]);
        return;
        default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
        }
      };

      // A module that can be mixed in to *any object* in order to provide it with
      // custom events. You may bind with `on` or remove with `off` callback
      // functions to an event; `trigger`-ing an event fires all callbacks in
      // succession.
      //
      //     var object = {};
      //     _.extend(object, Backbone.Events);
      //     object.on('expand', function(){ alert('expanded'); });
      //     object.trigger('expand');
      //
      var Events = {

        // Bind one or more space separated events, or an events map,
        // to a `callback` function. Passing `"all"` will bind the callback to
        // all events fired.
        on: function(name, callback, context) {
          if (!(eventsApi(this, 'on', name, [callback, context]) && callback)) return this;
          this._events || (this._events = {});
          var list = this._events[name] || (this._events[name] = []);
          list.push({callback: callback, context: context, ctx: context || this});
          return this;
        },

        // Bind events to only be triggered a single time. After the first time
        // the callback is invoked, it will be removed.
        once: function(name, callback, context) {
          if (!(eventsApi(this, 'once', name, [callback, context]) && callback)) return this;
          var self = this;
          var once = _.once(function() {
            self.off(name, once);
            callback.apply(this, arguments);
          });
          once._callback = callback;
          this.on(name, once, context);
          return this;
        },

        // Remove one or many callbacks. If `context` is null, removes all
        // callbacks with that function. If `callback` is null, removes all
        // callbacks for the event. If `name` is null, removes all bound
        // callbacks for all events.
        off: function(name, callback, context) {
          var list, ev, events, names, i, l, j, k;
          if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
          if (!name && !callback && !context) {
            this._events = {};
            return this;
          }

          names = name ? [name] : _.keys(this._events);
          for (i = 0, l = names.length; i < l; i++) {
            name = names[i];
            if (list = this._events[name]) {
              events = [];
              if (callback || context) {
                for (j = 0, k = list.length; j < k; j++) {
                  ev = list[j];
                  if ((callback && callback !== ev.callback &&
                                   callback !== ev.callback._callback) ||
                      (context && context !== ev.context)) {
                    events.push(ev);
                  }
                }
              }
              this._events[name] = events;
            }
          }

          return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function(name) {
          if (!this._events) return this;
          var args = slice.call(arguments, 1);
          if (!eventsApi(this, 'trigger', name, args)) return this;
          var events = this._events[name];
          var allEvents = this._events.all;
          if (events) triggerEvents(this, events, args);
          if (allEvents) triggerEvents(this, allEvents, arguments);
          return this;
        }
      };

      // Aliases for backwards compatibility.
      Events.bind   = Events.on;
      Events.unbind = Events.off;

    /* end Backbone.Events section */


    function mixinEvents(object) {
      for (var key in Events) {
        object[key] = Events[key];
      }
      return object;
    };


    function all(futures) {
      var i, results = [];
      var allPromise = new Promise();
      var remaining = futures.length;

      if (remaining === 0) {
        allPromise.resolve([]);
      }

      var resolver = function(index) {
        return function(value) {
          resolve(index, value);
        };
      };

      var resolve = function(index, value) {
        results[index] = value;
        if (--remaining === 0) {
          allPromise.resolve(results);
        }
      };

      var reject = function(error) {
        allPromise.reject(error);
      };

      for (i = 0; i < remaining; i++) {
        futures[i].then(resolver(i), reject);
      }
      return allPromise.future;
    }


    var noop = function() {};

    var Promise = function() {
      this.future = new Future(this);
    };

    Promise.prototype = {
      resolve: function(value) {
        this.resolve = noop;
        this.reject = noop;
        config.async(function() {
          this.trigger('promise:resolved', value);
        }, this);
      },

      reject: function(value) {
        this.resolve = noop;
        this.reject = noop;
        config.async(function() {
          this.trigger('promise:rejected', value);
        }, this);
      },

      //Conveniece, maintaining single object interface.
      then: function(done, fail) {
        return this.future.then(done, fail);
      }
    };

    mixinEvents(Promise.prototype);


    //Futures are write-once and shouldn't be instantiated or written to directly.  A Promise will
    //creata a Future that it will write into by firing events, and the Future will only respond
    //to those events the first time.
    var Future = function(promise) {
      promise.once('promise:resolved', function(value) {
        this.wasResolved = true;
        this.resolvedValue = value;
        this.trigger('future:success', value);
      }, this);
      promise.once('promise:rejected', function(value) {
        this.wasRejected = true;
        this.rejectedValue = value;
        this.trigger('future:failure', value);
      }, this);
    };

    //Call the callback with the given arg and resolve the promise when
    //done.
    var invokeCallback = function(type, promise, callback, arg) {
      var hasCallback = typeof callback === 'function',
          value, error, succeeded, failed;

      //Catch exceptions in the callback and pass them on as failure
      if (hasCallback) {
        try {
          value = callback(arg);
          succeeded = true;
        } catch(e) {
          failed = true;
          error = e;
        }
      } else {
        value = arg
        succeeded = true;
      }

      //If the callback returned a Future, wait until it completes.
      if (value && typeof value.then === 'function') {
        value.then(function(value) {
          promise.resolve(value);
        }, function(error) {
          promise.reject(error);
        });
      } else if (hasCallback && succeeded) {
        promise.resolve(value);
      } else if (failed) {
        promise.reject(error);
      } else {
        promise[type](value);
      }
    };

    //Adds callbacks to the future.
    //Calls the right callback asynchronously, but immediately, if the Future was already'
    //completed.
    //Returns a Future that will resolve when the callback is done.
    Future.prototype.then = function(done, fail) {
      var thenPromise = new Promise();

      if (this.wasResolved) {
        config.async(function() {
          invokeCallback('resolve', thenPromise, done, this.resolvedValue);
        }, this);
      } else if (this.wasRejected) {
        config.async(function() {
          invokeCallback('reject', thenPromise, fail, this.rejectedValue);
        }, this);
      } else {
        this.once('future:success', function(value) {
          invokeCallback('resolve', thenPromise, done, value);
        });
        this.once('future:failure', function(value) {
          invokeCallback('reject', thenPromise, fail, value);
        });
      }

      return thenPromise.future;
    };
    mixinEvents(Future.prototype);


    __exports__.Promise = Promise;
    __exports__.all = all;
    __exports__.configure = configure;
    __exports__.Events = Events;
  });
