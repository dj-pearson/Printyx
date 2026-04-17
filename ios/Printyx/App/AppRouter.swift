import SwiftUI
import Combine

/// Typed route values that the app can push/pop on a NavigationStack. Adding
/// a case here requires a matching branch in every NavigationStack's
/// `navigationDestination(for:)` — keep this list tight.
enum AppRoute: Hashable {
    case businessRecord(id: String)
    case opportunity(id: String)
    case quote(id: String)
    case proposal(id: String)
    case serviceTicket(id: String)
    case equipment(id: String)
    case contract(id: String)
    case invoice(id: String)
    case task(id: String)
    case contact(id: String)

    /// Which tab the route belongs to. Used by the router to switch tabs
    /// before pushing when a deep link targets a different tab than the
    /// currently selected one.
    var preferredTab: AppTab {
        switch self {
        case .businessRecord, .contact: return .crm
        case .opportunity, .quote, .proposal, .contract: return .sales
        case .serviceTicket, .equipment: return .service
        case .invoice, .task: return .more
        }
    }
}

/// Tab identifiers — kept in lockstep with MainTabView's tag values so the
/// router can programmatically select a tab without hardcoding ints elsewhere.
enum AppTab: Int, Hashable {
    case home = 0, crm, service, sales, more
}

/// Central navigation coordinator. One path per tab so each tab keeps its own
/// back-stack, matching how reps expect iOS tab bars to behave.
///
/// Push-notification taps, global search results, and future deep links all
/// route through `push(_:)`, which also switches the selected tab when the
/// target route belongs to a different tab.
@MainActor
final class AppRouter: ObservableObject {

    @Published var selectedTab: AppTab = .home
    @Published var homePath = NavigationPath()
    @Published var crmPath = NavigationPath()
    @Published var servicePath = NavigationPath()
    @Published var salesPath = NavigationPath()
    @Published var morePath = NavigationPath()

    /// Push a route onto its preferred tab, switching tabs first if needed.
    func push(_ route: AppRoute) {
        selectedTab = route.preferredTab
        switch route.preferredTab {
        case .home: homePath.append(route)
        case .crm: crmPath.append(route)
        case .service: servicePath.append(route)
        case .sales: salesPath.append(route)
        case .more: morePath.append(route)
        }
    }

    /// Pop the top route from the currently-selected tab's path. Useful for
    /// back-button handling in non-standard gesture flows.
    func popTop() {
        switch selectedTab {
        case .home: if !homePath.isEmpty { homePath.removeLast() }
        case .crm: if !crmPath.isEmpty { crmPath.removeLast() }
        case .service: if !servicePath.isEmpty { servicePath.removeLast() }
        case .sales: if !salesPath.isEmpty { salesPath.removeLast() }
        case .more: if !morePath.isEmpty { morePath.removeLast() }
        }
    }

    /// Clear every tab's path. Called on sign-out so stale navigation state
    /// doesn't bleed across sessions.
    func reset() {
        homePath = NavigationPath()
        crmPath = NavigationPath()
        servicePath = NavigationPath()
        salesPath = NavigationPath()
        morePath = NavigationPath()
        selectedTab = .home
    }

    /// Bindings for the SwiftUI NavigationStack(path:) APIs. Returning a
    /// Binding keeps per-tab state colocated on the router without every view
    /// having to crack open the published properties individually.
    func pathBinding(for tab: AppTab) -> Binding<NavigationPath> {
        Binding(
            get: { [weak self] in
                switch tab {
                case .home: return self?.homePath ?? NavigationPath()
                case .crm: return self?.crmPath ?? NavigationPath()
                case .service: return self?.servicePath ?? NavigationPath()
                case .sales: return self?.salesPath ?? NavigationPath()
                case .more: return self?.morePath ?? NavigationPath()
                }
            },
            set: { [weak self] newValue in
                guard let self else { return }
                switch tab {
                case .home: self.homePath = newValue
                case .crm: self.crmPath = newValue
                case .service: self.servicePath = newValue
                case .sales: self.salesPath = newValue
                case .more: self.morePath = newValue
                }
            }
        )
    }
}
