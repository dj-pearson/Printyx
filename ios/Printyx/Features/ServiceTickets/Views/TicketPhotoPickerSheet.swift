import SwiftUI
import PhotosUI

/// Bottom sheet that lets a field technician attach up to 3 photos to a
/// service ticket. Uses PhotosPicker under the hood; each selected photo is
/// base64-encoded and POSTed to `/api/service-tickets/:id/attachments`.
///
/// Offline behavior: the upload goes through APIClient, which routes
/// mutations that fail with .networkError through OfflineWriteQueue — so a
/// technician on a weak signal can still capture the photo and trust it
/// will sync when they're back on Wi-Fi.
struct TicketPhotoPickerSheet: View {
    let ticketId: String
    let apiClient: APIClient
    /// Fired for every photo successfully uploaded or queued.
    let onUploaded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selection: [PhotosPickerItem] = []
    @State private var uploadResults: [UploadResult] = []
    @State private var isUploading = false

    private struct UploadResult: Identifiable {
        let id = UUID()
        let filename: String
        let status: Status
        enum Status { case uploaded, queued, failed(String) }
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.lg) {
                Text("Attach photos of error codes, meters, or damage. Up to 3 per submit.")
                    .font(.printyxCaption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)

                PhotosPicker(
                    selection: $selection,
                    maxSelectionCount: 3,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Label("Select photos", systemImage: "photo.on.rectangle.angled")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.printyxPrimary.opacity(0.12))
                        .cornerRadius(AppTheme.Radius.md)
                }
                .padding(.horizontal)

                if !uploadResults.isEmpty {
                    List(uploadResults) { result in
                        HStack {
                            Text(result.filename)
                                .font(.printyxCaption)
                            Spacer()
                            statusBadge(for: result.status)
                        }
                    }
                    .listStyle(.insetGrouped)
                }

                Spacer()
            }
            .padding(.top, AppTheme.Spacing.md)
            .navigationTitle("Add Photos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onChange(of: selection) { _, newItems in
                guard !newItems.isEmpty else { return }
                Task { await upload(items: newItems) }
            }
        }
    }

    @ViewBuilder
    private func statusBadge(for status: UploadResult.Status) -> some View {
        switch status {
        case .uploaded:
            StatusBadge("Uploaded", color: .statusCompleted, icon: "checkmark")
        case .queued:
            StatusBadge("Will sync", color: .statusNew, icon: "arrow.triangle.2.circlepath")
        case .failed(let message):
            StatusBadge(message, color: .statusOverdue, icon: "exclamationmark.triangle")
        }
    }

    // MARK: - Upload

    private func upload(items: [PhotosPickerItem]) async {
        isUploading = true
        defer { isUploading = false }

        for (index, item) in items.enumerated() {
            let filename = "ticket-\(ticketId)-\(Date().timeIntervalSince1970)-\(index).jpg"
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    uploadResults.append(.init(filename: filename, status: .failed("Unable to read")))
                    continue
                }
                // Shrink if the source is huge — base64-encoding a 10MB
                // photo balloons to ~14MB plus JSON overhead.
                let compressed = compress(imageData: data)
                let body = AttachmentBody(
                    filename: filename,
                    mimeType: "image/jpeg",
                    base64: compressed.base64EncodedString()
                )
                do {
                    try await apiClient.requestVoid(
                        .uploadTicketAttachment(ticketId: ticketId, body: body)
                    )
                    uploadResults.append(.init(filename: filename, status: .uploaded))
                    onUploaded()
                } catch let apiError as APIError {
                    if case .offlineQueued = apiError {
                        uploadResults.append(.init(filename: filename, status: .queued))
                        onUploaded()
                    } else {
                        uploadResults.append(.init(
                            filename: filename,
                            status: .failed(apiError.errorDescription ?? "Failed")
                        ))
                    }
                }
            } catch {
                uploadResults.append(.init(filename: filename, status: .failed(error.localizedDescription)))
            }
        }
        // Clear the PhotosPicker selection so onChange fires again for the
        // next batch instead of re-uploading the last one.
        selection = []
    }

    /// Downsize photos to keep the base64 payload reasonable. Target ~1MB.
    private func compress(imageData: Data) -> Data {
        guard let image = UIImage(data: imageData) else { return imageData }
        let maxDim: CGFloat = 1600
        let size = image.size
        let scale: CGFloat = min(1, maxDim / max(size.width, size.height))
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        return resized.jpegData(compressionQuality: 0.7) ?? imageData
    }

    private struct AttachmentBody: Encodable {
        let filename: String
        let mimeType: String
        let base64: String
    }
}
