import Foundation

/// Represents all possible API errors in the Printyx networking layer.
enum APIError: LocalizedError {
    case invalidURL
    case invalidRequest
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case validationError(message: String, details: [String: String]?)
    case serverError(statusCode: Int, message: String?)
    case networkError(Error)
    case decodingError(Error)
    case tokenRefreshFailed
    case noTenantContext
    case rateLimited(retryAfter: TimeInterval?)
    case unknown(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidRequest:
            return "Invalid request"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .notFound:
            return "The requested resource was not found."
        case .validationError(let message, _):
            return message
        case .serverError(_, let message):
            return message ?? "An internal server error occurred."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        case .tokenRefreshFailed:
            return "Unable to refresh your session. Please sign in again."
        case .noTenantContext:
            return "No organization context found. Please sign in again."
        case .rateLimited(let retryAfter):
            if let retryAfter {
                return "Too many requests. Please wait \(Int(retryAfter)) seconds."
            }
            return "Too many requests. Please try again later."
        case .unknown(let statusCode):
            return "Unexpected error (status \(statusCode))"
        }
    }

    var isAuthError: Bool {
        switch self {
        case .unauthorized, .tokenRefreshFailed:
            return true
        default:
            return false
        }
    }
}

/// Standard error response from the Printyx API.
/// Supports both Express backend format (message) and Supabase GoTrue format (error/error_description/msg).
struct APIErrorResponse: Decodable {
    let message: String?
    let code: String?
    let details: [String: String]?
    let requestId: String?
    // Supabase GoTrue error fields
    let error: String?
    let errorDescription: String?
    let msg: String?

    /// Returns the best available error message from any format.
    var displayMessage: String? {
        // Prefer explicit message, then GoTrue error_description, then error, then msg
        if let message, !message.isEmpty { return message }
        if let errorDescription, !errorDescription.isEmpty { return errorDescription }
        if let error, !error.isEmpty { return error }
        if let msg, !msg.isEmpty { return msg }
        return nil
    }
}
