import Foundation
import ScreenCaptureKit
import AVFoundation

@available(macOS 13.0, *)
class AudioCapture: NSObject, SCStreamDelegate, SCStreamOutput {
    private var stream: SCStream?
    private var isRunning = false
    private let captureMode: String

    init(captureMode: String) {
        self.captureMode = captureMode
        super.init()
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: false
        )

        guard let display = content.displays.first else {
            throw NSError(domain: "AudioCapture", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "No display found"
            ])
        }

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = true
        config.sampleRate = 16000
        config.channelCount = 1

        let filter = buildFilter(content: content, display: display, mode: captureMode)

        stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream?.addStreamOutput(
            self,
            type: .audio,
            sampleHandlerQueue: DispatchQueue.global()
        )
        try await stream?.startCapture()
        isRunning = true

        FileHandle.standardError.write("AUDIO_STARTED mode=\(captureMode)\n".data(using: .utf8)!)
    }

    private func buildFilter(
        content: SCShareableContent,
        display: SCDisplay,
        mode: String
    ) -> SCContentFilter {
        if mode == "meeting" {
            let meetingBundleIds: Set<String> = [
                "us.zoom.xos",
                "com.microsoft.teams2",
                "com.microsoft.teams",
                "com.tinyspeck.slackmacgap",
                "com.hnc.Discord",
                "com.apple.FaceTime",
                "com.google.Chrome",
                "com.google.Chrome.canary",
                "company.thebrowser.Browser",
                "com.brave.Browser",
                "org.mozilla.firefox",
                "com.apple.Safari",
            ]

            let meetingApps = content.applications.filter {
                meetingBundleIds.contains($0.bundleIdentifier)
            }

            if !meetingApps.isEmpty {
                let excluded = content.applications.filter {
                    !meetingBundleIds.contains($0.bundleIdentifier)
                }
                return SCContentFilter(
                    display: display,
                    excludingApplications: excluded,
                    exceptingWindows: []
                )
            }

            FileHandle.standardError.write(
                "AUDIO_FALLBACK display capture — no meeting app found\n".data(using: .utf8)!
            )
        }

        return SCContentFilter(
            display: display,
            excludingApplications: [],
            exceptingWindows: []
        )
    }

    func stop() async throws {
        try await stream?.stopCapture()
        isRunning = false
        FileHandle.standardError.write("AUDIO_STOPPED\n".data(using: .utf8)!)
    }

    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard type == .audio else { return }
        guard let data = extractPCMData(from: sampleBuffer) else { return }

        FileHandle.standardOutput.write(data)
    }

    private func extractPCMData(from sampleBuffer: CMSampleBuffer) -> Data? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription) else {
            return nil
        }
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else {
            return nil
        }

        var length = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(
            blockBuffer,
            atOffset: 0,
            lengthAtOffsetOut: nil,
            totalLengthOut: &length,
            dataPointerOut: &dataPointer
        )
        guard let pointer = dataPointer, length > 0 else { return nil }

        let format = asbd.pointee
        let isFloat = (format.mFormatFlags & kAudioFormatFlagIsFloat) != 0
        let bytesPerFrame = Int(format.mBytesPerFrame)
        guard bytesPerFrame > 0 else { return nil }
        let frameCount = length / bytesPerFrame

        if isFloat && bytesPerFrame == 4 {
            var int16Data = Data(capacity: frameCount * 2)
            pointer.withMemoryRebound(to: Float.self, capacity: frameCount) { floatPtr in
                for i in 0..<frameCount {
                    let sample = floatPtr[i]
                    let clamped = max(-1.0, min(1.0, sample))
                    let int16Sample = Int16(clamped * 32767.0)
                    var le = int16Sample.littleEndian
                    int16Data.append(Data(bytes: &le, count: 2))
                }
            }
            return int16Data
        }

        return Data(bytes: pointer, count: length)
    }

    func stream(
        _ stream: SCStream,
        didStopWithError error: Error
    ) {
        FileHandle.standardError.write(
            "AUDIO_ERROR: \(error)\n".data(using: .utf8)!
        )
    }
}

@available(macOS 13.0, *)
class Main {
    static func run() async {
        let mode = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "meeting"
        let capture = AudioCapture(captureMode: mode)
        do {
            try await capture.start()
            try await Task.sleep(nanoseconds: UInt64.max)
        } catch {
            FileHandle.standardError.write(
                "Failed: \(error)\n".data(using: .utf8)!
            )
            exit(1)
        }
    }
}

if #available(macOS 13.0, *) {
    Task {
        await Main.run()
    }
    RunLoop.main.run()
} else {
    FileHandle.standardError.write(
        "Requires macOS 13+\n".data(using: .utf8)!
    )
    exit(1)
}
