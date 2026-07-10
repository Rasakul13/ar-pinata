import SwiftUI
import UIKit

enum FinalTheme: String {
    case blue
    case pink

    static var current: FinalTheme {
        FinalTheme(rawValue: BuildTheme.name.lowercased()) ?? .blue
    }

    var primary: UIColor {
        switch self {
        case .blue: UIColor(red: 0.663, green: 0.863, blue: 1.0, alpha: 1)
        case .pink: UIColor(red: 0.965, green: 0.714, blue: 0.812, alpha: 1)
        }
    }

    var light: UIColor {
        switch self {
        case .blue: UIColor(red: 0.79, green: 0.92, blue: 1.0, alpha: 1)
        case .pink: UIColor(red: 1.0, green: 0.86, blue: 0.91, alpha: 1)
        }
    }

    var dark: UIColor {
        switch self {
        case .blue: UIColor(red: 0.47, green: 0.75, blue: 0.91, alpha: 1)
        case .pink: UIColor(red: 0.91, green: 0.60, blue: 0.73, alpha: 1)
        }
    }

    var swiftUIColor: Color {
        Color(uiColor: primary)
    }
}
