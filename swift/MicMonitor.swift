import AppKit
import CoreAudio
import Foundation

/// Emits JSON lines about whether the system microphone is in use by another app.
/// No audio samples are captured — device/process state only (Granola-style detection).

struct MicSnapshot: Encodable {
    let inUse: Bool
    let pids: [Int32]
    let bundleIds: [String]
}

let meetingBundleIds: Set<String> = [
    "us.zoom.xos",
    "com.microsoft.teams2",
    "com.microsoft.teams",
    "com.tinyspeck.slackmacgap",
    "com.hnc.Discord",
    "com.apple.FaceTime",
    "net.whatsapp.WhatsApp",
    "com.google.Chrome",
    "com.google.Chrome.canary",
    "company.thebrowser.Browser",
    "com.brave.Browser",
    "org.mozilla.firefox",
    "com.apple.Safari",
    "com.microsoft.edgemac",
]

func defaultInputDeviceID() -> AudioDeviceID? {
    var deviceID = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject),
        &address,
        0,
        nil,
        &size,
        &deviceID
    )
    guard status == noErr, deviceID != kAudioObjectUnknown else { return nil }
    return deviceID
}

func deviceIsRunningSomewhere(_ deviceID: AudioDeviceID) -> Bool {
    var running: UInt32 = 0
    var size = UInt32(MemoryLayout<UInt32>.size)
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, &running)
    return status == noErr && running != 0
}

func processObjectList() -> [AudioObjectID] {
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyProcessObjectList,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    var dataSize: UInt32 = 0
    var status = AudioObjectGetPropertyDataSize(
        AudioObjectID(kAudioObjectSystemObject),
        &address,
        0,
        nil,
        &dataSize
    )
    guard status == noErr, dataSize > 0 else { return [] }
    let count = Int(dataSize) / MemoryLayout<AudioObjectID>.size
    var objects = [AudioObjectID](repeating: 0, count: count)
    status = AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject),
        &address,
        0,
        nil,
        &dataSize,
        &objects
    )
    guard status == noErr else { return [] }
    return objects
}

func processIsRunningInput(_ objectID: AudioObjectID) -> Bool {
    var running: UInt32 = 0
    var size = UInt32(MemoryLayout<UInt32>.size)
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioProcessPropertyIsRunningInput,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(objectID, &address, 0, nil, &size, &running)
    return status == noErr && running != 0
}

func processPID(_ objectID: AudioObjectID) -> pid_t? {
    var pid: pid_t = 0
    var size = UInt32(MemoryLayout<pid_t>.size)
    var address = AudioObjectPropertyAddress(
        mSelector: kAudioProcessPropertyPID,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(objectID, &address, 0, nil, &size, &pid)
    guard status == noErr, pid > 0 else { return nil }
    return pid
}

func bundleId(for pid: pid_t) -> String? {
    NSRunningApplication(processIdentifier: pid)?.bundleIdentifier
}

func runningMeetingBundleIds() -> [String] {
    NSWorkspace.shared.runningApplications.compactMap { app in
        guard let id = app.bundleIdentifier, meetingBundleIds.contains(id) else { return nil }
        return id
    }
}

func snapshot() -> MicSnapshot {
    let deviceID = defaultInputDeviceID()
    let deviceBusy = deviceID.map(deviceIsRunningSomewhere) ?? false

    var pids: [Int32] = []
    var bundles: [String] = []

    if #available(macOS 14.0, *) {
        for objectID in processObjectList() where processIsRunningInput(objectID) {
            guard let pid = processPID(objectID) else { continue }
            pids.append(pid)
            if let bundle = bundleId(for: pid) {
                bundles.append(bundle)
            }
        }
    }

    let inUse = deviceBusy || !pids.isEmpty
    if bundles.isEmpty, inUse {
        bundles = runningMeetingBundleIds()
    }

    // Prefer known meeting apps when listing bundles.
    let preferred = bundles.filter { meetingBundleIds.contains($0) }
    let finalBundles = preferred.isEmpty ? Array(Set(bundles)).sorted() : Array(Set(preferred)).sorted()

    return MicSnapshot(inUse: inUse, pids: Array(Set(pids)).sorted(), bundleIds: finalBundles)
}

func emit(_ snap: MicSnapshot) {
    guard let data = try? JSONEncoder().encode(snap),
          let line = String(data: data, encoding: .utf8)
    else { return }
    FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
}

emit(snapshot())

let timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
    emit(snapshot())
}
RunLoop.main.add(timer, forMode: .common)
RunLoop.main.run()
