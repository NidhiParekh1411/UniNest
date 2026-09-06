// Express 4 does not understand a rejected promise. An async handler that
// throws never reaches the error middleware: the rejection escapes to the
// process and the client waits until it times out. Now that persistence is
// asynchronous every handler in this app is async, so that failure mode would
// apply to every route — a dropped database connection would hang requests
// instead of returning a 500.
//
// Express 5 fixes this natively. Until then, this walks the mounted router
// tree once at startup and wraps each handler so a rejection is forwarded to
// next(), which is what the error middleware in index.js already expects.
export function forwardAsyncErrors(app) {
  const seen = new WeakSet();

  const wrap = (fn) => {
    // Error middleware (4 args) keeps its signature — Express identifies it by
    // arity, so the wrapper has to declare four parameters too.
    if (fn.length === 4) {
      return function wrapped(err, req, res, next) {
        try {
          return Promise.resolve(fn.call(this, err, req, res, next)).catch(next);
        } catch (e) { return next(e); }
      };
    }
    return function wrapped(req, res, next) {
      try {
        return Promise.resolve(fn.call(this, req, res, next)).catch(next);
      } catch (e) { return next(e); }
    };
  };

  const walk = (stack) => {
    if (!stack || seen.has(stack)) return;
    seen.add(stack);
    for (const layer of stack) {
      if (typeof layer.handle === 'function' && !layer.handle.__asyncWrapped) {
        const inner = layer.handle;
        // A mounted router is a function too; recurse into it rather than
        // wrapping it, or its own error handling would be bypassed.
        if (inner.stack) walk(inner.stack);
        else {
          const wrapped = wrap(inner);
          wrapped.__asyncWrapped = true;
          layer.handle = wrapped;
        }
      }
      if (layer.route?.stack) {
        for (const s of layer.route.stack) {
          if (typeof s.handle === 'function' && !s.handle.__asyncWrapped) {
            const wrapped = wrap(s.handle);
            wrapped.__asyncWrapped = true;
            s.handle = wrapped;
          }
        }
      }
    }
  };

  walk(app._router?.stack ?? app.router?.stack);
  return app;
}
