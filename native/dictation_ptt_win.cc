#include <node_api.h>
#include <atomic>
#include <windows.h>

static std::atomic<bool> g_running(false);
static std::atomic<bool> g_keyHeld(false);
static HANDLE g_pollThread = nullptr;
static napi_threadsafe_function g_tsfn = nullptr;
static int g_vkCode = VK_RCONTROL;

static void emitPttEvent(const char* eventName) {
  if (g_tsfn == nullptr) return;
  napi_call_threadsafe_function(g_tsfn, (void*)eventName, napi_tsfn_nonblocking);
}

static void tsfnCallback(napi_env env, napi_value js_callback, void* context, void* data) {
  (void)context;
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

static void pollLoop() {
  while (g_running.load()) {
    const SHORT state = GetAsyncKeyState(g_vkCode);
    const bool down = (state & 0x8000) != 0;
    if (down && !g_keyHeld.load()) {
      g_keyHeld.store(true);
      emitPttEvent("down");
    } else if (!down && g_keyHeld.load()) {
      g_keyHeld.store(false);
      emitPttEvent("up");
    }
    Sleep(20);
  }
}

static DWORD WINAPI pollThreadProc(LPVOID) {
  pollLoop();
  return 0;
}

static napi_value StartMonitor(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  if (napi_get_cb_info(env, info, &argc, args, nullptr, nullptr) != napi_ok || argc < 1) {
    napi_throw_type_error(env, nullptr, "Expected callback function");
    return nullptr;
  }

  if (argc >= 2) {
    int32_t vk = VK_RCONTROL;
    napi_get_value_int32(env, args[1], &vk);
    if (vk > 0) g_vkCode = vk;
  }

  if (g_running.load()) {
    napi_value result;
    napi_get_boolean(env, true, &result);
    return result;
  }

  napi_value resourceName;
  napi_create_string_utf8(env, "dictationPtt", NAPI_AUTO_LENGTH, &resourceName);

  if (napi_create_threadsafe_function(
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
        &g_tsfn) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create threadsafe function");
    return nullptr;
  }

  g_running.store(true);
  g_keyHeld.store(false);
  g_pollThread = CreateThread(nullptr, 0, pollThreadProc, nullptr, 0, nullptr);
  if (g_pollThread == nullptr) {
    g_running.store(false);
    napi_release_threadsafe_function(g_tsfn, napi_tsfn_release);
    g_tsfn = nullptr;
    napi_throw_error(env, nullptr, "Failed to start poll thread");
    return nullptr;
  }

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
  g_keyHeld.store(false);
  if (g_pollThread != nullptr) {
    WaitForSingleObject(g_pollThread, INFINITE);
    CloseHandle(g_pollThread);
    g_pollThread = nullptr;
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
