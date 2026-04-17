import Foundation
import Speech
import AVFoundation

/// Thin wrapper around SFSpeechRecognizer for the QuickLog description field.
/// Handles authorization, the audio-engine tap, and the partial-result stream.
///
/// This is intentionally small — we only need dictation into a text field; the
/// full-blown voice command surface is a separate story.
@MainActor
final class SpeechTranscriber: NSObject, ObservableObject {

    @Published private(set) var isRecording = false
    @Published private(set) var transcript: String = ""
    @Published private(set) var errorMessage: String?
    @Published private(set) var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    override init() {
        super.init()
        self.authorizationStatus = SFSpeechRecognizer.authorizationStatus()
    }

    // MARK: - Authorization

    /// Requests speech and microphone permission. Returns true only when both
    /// are granted. The user can deny either independently, which is why we
    /// check them separately rather than trusting a single flag.
    func requestAuthorization() async -> Bool {
        let speechStatus = await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status)
            }
        }
        self.authorizationStatus = speechStatus
        guard speechStatus == .authorized else { return false }

        let micStatus = await withCheckedContinuation { cont in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
        return micStatus
    }

    // MARK: - Start / Stop

    /// Starts dictation. Appends to `transcript` as partial results arrive
    /// so callers can bind directly to it. Idempotent — calling while
    /// already recording is a no-op.
    func start() async {
        guard !isRecording else { return }
        errorMessage = nil
        transcript = ""

        guard await requestAuthorization() else {
            errorMessage = "Dictation requires microphone and speech permissions."
            return
        }
        guard let recognizer, recognizer.isAvailable else {
            errorMessage = "Speech recognition is not available on this device."
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            errorMessage = "Could not start audio session."
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            errorMessage = "Could not start microphone."
            cleanup()
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.cleanup()
                }
            }
        }

        isRecording = true
    }

    func stop() {
        guard isRecording else { return }
        cleanup()
    }

    private func cleanup() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
