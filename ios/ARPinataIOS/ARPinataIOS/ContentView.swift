import ARKit
import SwiftUI

struct ContentView: View {
    @State private var hasStarted = false

    var body: some View {
        ZStack {
            if hasStarted {
                ARGameView()
                    .ignoresSafeArea()
            } else {
                LinearGradient(
                    colors: [Color(red: 0.02, green: 0.03, blue: 0.05), Color(red: 0.05, green: 0.10, blue: 0.14)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 22) {
                    Text("AR Pinata")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundStyle(FinalTheme.current.swiftUIColor)

                    Text("Find the pinata, hit it six times, and reveal the surprise.")
                        .font(.headline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white.opacity(0.86))
                        .padding(.horizontal, 28)

                    if ARWorldTrackingConfiguration.isSupported {
                        Button {
                            hasStarted = true
                        } label: {
                            Text("Start AR")
                                .font(.headline)
                                .frame(minWidth: 170, minHeight: 50)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(FinalTheme.current.swiftUIColor)
                    } else {
                        Text("ARKit world tracking is not supported on this device.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
                .padding(24)
            }
        }
        .statusBarHidden(hasStarted)
    }
}
