#include <node_api.h>

static napi_value Noop(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value result;
  napi_get_boolean(env, true, &result);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value startFn;
  napi_value stopFn;
  napi_create_function(env, "startMonitor", NAPI_AUTO_LENGTH, Noop, nullptr, &startFn);
  napi_create_function(env, "stopMonitor", NAPI_AUTO_LENGTH, Noop, nullptr, &stopFn);
  napi_set_named_property(env, exports, "startMonitor", startFn);
  napi_set_named_property(env, exports, "stopMonitor", stopFn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
