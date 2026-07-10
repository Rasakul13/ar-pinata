import ARKit
import SwiftUI

struct ARGameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> ARSCNView {
        let controller = ARGameController(theme: .current)
        context.coordinator.controller = controller
        controller.start()
        return controller.sceneView
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {}

    static func dismantleUIView(_ uiView: ARSCNView, coordinator: Coordinator) {
        coordinator.controller?.stop()
        coordinator.controller = nil
    }

    final class Coordinator {
        var controller: ARGameController?
    }
}
