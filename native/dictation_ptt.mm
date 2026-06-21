#include <node_api.h>
#include <atomic>
#include <thread>

#import <ApplicationServices/ApplicationServices.h>

static std::atomic<bool> g_running(false);
static std::atomic<bool> g_fnHeld(false);
static CFMachPortRef g_eventTap = nullptr;
static CFRunLoopSourceRef g_runLoopSource = nullptr;
static std::thread g_tapThread;
static CFRunLoopRef g_tapRunLoop = nullptr;
static napi_threadsafe_function g_tsfn = nullptr;

static void emitPttEvent(const char* eventName) {
  if (g_tsfn == nullptr) return;
  napi_call_threadsafe_function(g_tsfn, (void*)eventName, napi_tsfn_nonblocking);
}

static void tsfnCallback(napi_env env, napi_value js_callback, void* context, void* data) {
  if (env == nullptr || js_callback == nullptr || data == nullptr) return;
  const char* eventName = static_cast<const char*>(data);
  napi_value eventValue;
  napi_create_string_utf8(env, eventName, NAPI_AUTO_LENGTH, &eventValue);
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  napi_value argv[1] = { eventValue };
  napi_value result;
  napi_call_function(env, undefined, js_callback, 1, argv, &result);
}

static CGEventRef tapCallback(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void* userData) {
  (void)proxy;
  (void)userData;

  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    if (g_eventTap != nullptr) {
      CGEventTapEnable(g_eventTap, true);
    }
    return event;
  }

  if (type != kCGEventFlagsChanged && type != kCGEventKeyDown && type != kCGEventKeyUp) {
    return event;
  }

  const CGEventFlags flags = CGEventGetFlags(event);
  const int64_t keyCode = CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode);
  const bool fnDown = (flags & kCGEventFlagMaskSecondaryFn) != 0 || keyCode == 63;

  if (fnDown && !g_fnHeld.load()) {
    g_fnHeld.store(true);
    emitPttEvent("down");
  } else if (!fnDown && g_fnHeld.load()) {
    g_fnHeld.store(false);
    emitPttEvent("up");
  }

  return event;
}

static void runTapLoop() {
  g_eventTap = CGEventTapCreate(
    kCGSessionEventTap,
    kCGHeadInsertEventTap,
    kCGEventTapOptionListenOnly,
    CGEventMaskBit(kCGEventFlagsChanged) | CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp),
    tapCallback,
    nullptr);

  if (g_eventTap == nullptr) {
    return;
  }

  g_runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, g_eventTap, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), g_runLoopSource, kCFRunLoopCommonModes);
  CGEventTapEnable(g_eventTap, true);
  g_tapRunLoop = CFRunLoopGetCurrent();
  CFRunLoopRun();
}

static napi_value StartMonitor(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  if (napi_get_cb_info(env, info, &argc, args, nullptr, nullptr) != napi_ok || argc < 1) {
    napi_throw_type_error(env, nullptr, "Expected callback function");
    return nullptr;
  }

  if (g_running.load()) {
    napi_value result;
    napi_get_boolean(env, true, &result);
    return result;
  }

  napi_value resourceName;
  napi_create_string_utf8(env, "dictationPtt", NAPI_AUTO_LENGTH, &resourceName);

  napi_create_threadsafe_function(
    env,
    args[0],
    nullptr,
    resourceName,
    0,
    1,
    nullptr,
    nullptr,
    nullptr,
    tsfnCallback,
    &g_tsfn);

  g_running.store(true);
  g_fnHeld.store(false);
  g_tapThread = std::thread([]() { runTapLoop(); });

  napi_value result;
  napi_get_boolean(env, true, &result);
  return result;
}

static napi_value StopMonitor(napi_env env, napi_callback_info info) {
  (void)info;
  if (!g_running.load()) {
    napi_value result;
    napi_get_boolean(env, false, &result);
    return result;
  }

  g_running.store(false);
  g_fnHeld.store(false);

  if (g_tapRunLoop != nullptr) {
    CFRunLoopStop(g_tapRunLoop);
    g_tapRunLoop = nullptr;
  }

  if (g_runLoopSource != nullptr) {
    CFRunLoopSourceInvalidate(g_runLoopSource);
    CFRelease(g_runLoopSource);
    g_runLoopSource = nullptr;
  }
  if (g_eventTap != nullptr) {
    CGEventTapEnable(g_eventTap, false);
    CFRelease(g_eventTap);
    g_eventTap = nullptr;
  }

  if (g_tapThread.joinable()) {
    g_tapThread.join();
  }

  if (g_tsfn != nullptr) {
    napi_release_threadsafe_function(g_tsfn, napi_tsfn_release);
    g_tsfn = nullptr;
  }

  napi_value result;
  napi_get_boolean(env, true, &result);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value startFn;
  napi_create_function(env, nullptr, 0, StartMonitor, nullptr, &startFn);
  napi_set_named_property(env, exports, "startMonitor", startFn);

  napi_value stopFn;
  napi_create_function(env, nullptr, 0, StopMonitor, nullptr, &stopFn);
  napi_set_named_property(env, exports, "stopMonitor", stopFn);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
