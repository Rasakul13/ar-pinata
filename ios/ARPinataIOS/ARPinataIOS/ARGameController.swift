import ARKit
import SceneKit
import UIKit
import simd

final class ARGameController: NSObject, ARSCNViewDelegate, ARSessionDelegate {
    let sceneView = ARSCNView(frame: .zero)

    private let theme: FinalTheme
    private let hitsToExplode = 6
    private let hitConfettiCount = 40
    private let explosionConfettiCount = 340
    private let rainBirthRate: CGFloat = 60
    private let hitCategory = 1 << 0

    private var hitCount = 0
    private var lastHitTime: TimeInterval = 0
    private var exploded = false
    private var hitLocked = false
    private var pinataRoot: SCNNode?
    private var pinataVisual: SCNNode?
    private var octopusRoot: SCNNode?
    private var worldTextRoot: SCNNode?
    private var rainEmitter: SCNNode?
    private var wanderWorkItem: DispatchWorkItem?

    private let finalLabel = UILabel()
    private let resetButton = UIButton(type: .system)

    init(theme: FinalTheme) {
        self.theme = theme
        super.init()
        configureSceneView()
        configureOverlay()
    }

    func start() {
        guard ARWorldTrackingConfiguration.isSupported else {
            showStatus("ARKit world tracking is not supported on this device.")
            return
        }

        let configuration = ARWorldTrackingConfiguration()
        configuration.worldAlignment = .gravity
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic
        sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
            self?.resetGame()
        }
    }

    func stop() {
        wanderWorkItem?.cancel()
        wanderWorkItem = nil
        sceneView.session.pause()
    }

    private func configureSceneView() {
        sceneView.delegate = self
        sceneView.session.delegate = self
        sceneView.scene = SCNScene()
        sceneView.autoenablesDefaultLighting = true
        sceneView.automaticallyUpdatesLighting = true
        sceneView.antialiasingMode = .multisampling4X

        let tapRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        sceneView.addGestureRecognizer(tapRecognizer)

        let coaching = ARCoachingOverlayView()
        coaching.session = sceneView.session
        coaching.goal = .tracking
        coaching.activatesAutomatically = true
        coaching.translatesAutoresizingMaskIntoConstraints = false
        sceneView.addSubview(coaching)
        NSLayoutConstraint.activate([
            coaching.leadingAnchor.constraint(equalTo: sceneView.leadingAnchor),
            coaching.trailingAnchor.constraint(equalTo: sceneView.trailingAnchor),
            coaching.topAnchor.constraint(equalTo: sceneView.topAnchor),
            coaching.bottomAnchor.constraint(equalTo: sceneView.bottomAnchor),
        ])
    }

    private func configureOverlay() {
        finalLabel.translatesAutoresizingMaskIntoConstraints = false
        finalLabel.text = "See you soon little one!"
        finalLabel.textColor = theme.primary
        finalLabel.font = .systemFont(ofSize: 42, weight: .heavy)
        finalLabel.textAlignment = .center
        finalLabel.numberOfLines = 2
        finalLabel.alpha = 0
        finalLabel.layer.shadowColor = UIColor.black.cgColor
        finalLabel.layer.shadowOpacity = 0.8
        finalLabel.layer.shadowRadius = 12
        finalLabel.layer.shadowOffset = CGSize(width: 0, height: 3)
        sceneView.addSubview(finalLabel)

        var configuration = UIButton.Configuration.filled()
        configuration.title = "Reset"
        configuration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.64)
        configuration.baseForegroundColor = .white
        configuration.cornerStyle = .medium
        resetButton.configuration = configuration
        resetButton.layer.borderColor = theme.primary.cgColor
        resetButton.layer.borderWidth = 1
        resetButton.alpha = 0
        resetButton.isHidden = true
        resetButton.translatesAutoresizingMaskIntoConstraints = false
        resetButton.addTarget(self, action: #selector(resetButtonPressed), for: .touchUpInside)
        sceneView.addSubview(resetButton)

        NSLayoutConstraint.activate([
            finalLabel.leadingAnchor.constraint(equalTo: sceneView.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            finalLabel.trailingAnchor.constraint(equalTo: sceneView.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            finalLabel.topAnchor.constraint(equalTo: sceneView.safeAreaLayoutGuide.topAnchor, constant: 18),
            resetButton.trailingAnchor.constraint(equalTo: sceneView.safeAreaLayoutGuide.trailingAnchor, constant: -18),
            resetButton.bottomAnchor.constraint(equalTo: sceneView.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            resetButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 90),
            resetButton.heightAnchor.constraint(equalToConstant: 46),
        ])
    }

    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard !exploded, !hitLocked, let pinataRoot else { return }

        let location = recognizer.location(in: sceneView)
        let results = sceneView.hitTest(location, options: nil)
        guard results.contains(where: { $0.node.isDescendant(of: pinataRoot) }) else { return }

        let now = CACurrentMediaTime()
        guard now - lastHitTime >= 0.14 else { return }
        lastHitTime = now
        registerHit()
    }

    @objc private func resetButtonPressed() {
        resetGame()
    }

    private func registerHit() {
        guard let pinataRoot else { return }
        hitCount += 1

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        shakePinata()

        if hitCount >= hitsToExplode {
            explodePinata(at: pinataRoot.presentation.position)
            return
        }

        emitConfetti(at: pinataRoot.presentation.position, count: hitConfettiCount, force: 1.0)
        relocatePinata(duration: 1.5, lift: 0.58, locksHits: true)
    }

    private func resetGame() {
        wanderWorkItem?.cancel()
        wanderWorkItem = nil
        pinataRoot?.removeAllActions()
        pinataRoot?.removeFromParentNode()
        octopusRoot?.removeFromParentNode()
        worldTextRoot?.removeFromParentNode()
        rainEmitter?.removeFromParentNode()

        pinataRoot = nil
        pinataVisual = nil
        octopusRoot = nil
        worldTextRoot = nil
        rainEmitter = nil
        hitCount = 0
        lastHitTime = 0
        exploded = false
        hitLocked = false

        finalLabel.alpha = 0
        resetButton.alpha = 0
        resetButton.isHidden = true

        guard sceneView.pointOfView != nil else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.resetGame() }
            return
        }

        let root = makePinata()
        root.position = randomPositionInFrontOfCamera(minDistance: 1.15, maxDistance: 3.2)
        orientTowardCamera(root, randomOffset: true)
        sceneView.scene.rootNode.addChildNode(root)
        pinataRoot = root
        scheduleNextWander(initial: true)
    }

    private func makePinata() -> SCNNode {
        let root = SCNNode()
        root.name = "pinata-root"

        let visual = SCNNode()
        visual.name = "pinata-visual"
        root.addChildNode(visual)
        pinataVisual = visual

        addPart(
            to: visual,
            geometry: SCNBox(width: 0.42, height: 0.25, length: 0.20, chamferRadius: 0.055),
            position: SCNVector3(0, 0.27, 0),
            color: UIColor(red: 0.96, green: 0.30, blue: 0.43, alpha: 1)
        )
        addPart(
            to: visual,
            geometry: SCNBox(width: 0.16, height: 0.21, length: 0.16, chamferRadius: 0.035),
            position: SCNVector3(0, 0.45, -0.05),
            color: UIColor(red: 1.0, green: 0.78, blue: 0.24, alpha: 1)
        )
        addPart(
            to: visual,
            geometry: SCNBox(width: 0.20, height: 0.17, length: 0.23, chamferRadius: 0.05),
            position: SCNVector3(0, 0.56, -0.14),
            color: UIColor(red: 0.35, green: 0.78, blue: 1.0, alpha: 1)
        )

        for x in [-0.14 as Float, 0.14] {
            for z in [-0.06 as Float, 0.06] {
                addPart(
                    to: visual,
                    geometry: SCNCapsule(capRadius: 0.038, height: 0.25),
                    position: SCNVector3(x, 0.10, z),
                    color: z < 0 ? UIColor.systemPurple : UIColor.systemGreen
                )
            }
        }

        for x in [-0.065 as Float, 0.065] {
            let ear = addPart(
                to: visual,
                geometry: SCNCone(topRadius: 0, bottomRadius: 0.045, height: 0.16),
                position: SCNVector3(x, 0.72, -0.12),
                color: UIColor(red: 0.73, green: 0.43, blue: 0.98, alpha: 1)
            )
            ear.eulerAngles.z = x < 0 ? 0.18 : -0.18
        }

        let tail = addPart(
            to: visual,
            geometry: SCNCone(topRadius: 0.015, bottomRadius: 0.055, height: 0.22),
            position: SCNVector3(0, 0.34, 0.20),
            color: UIColor.systemPink
        )
        tail.eulerAngles.x = .pi / 2

        let proxy = SCNNode(geometry: SCNSphere(radius: 0.36))
        proxy.name = "pinata-hit-proxy"
        proxy.opacity = 0.001
        proxy.position = SCNVector3(0, 0.34, 0)
        proxy.categoryBitMask = hitCategory
        root.addChildNode(proxy)

        let bobUp = SCNAction.moveBy(x: 0, y: 0.045, z: 0, duration: 0.42)
        bobUp.timingMode = .easeOut
        let bobDown = bobUp.reversed()
        bobDown.timingMode = .easeIn
        visual.runAction(.repeatForever(.sequence([bobUp, bobDown])), forKey: "idle-bob")
        return root
    }

    @discardableResult
    private func addPart(
        to parent: SCNNode,
        geometry: SCNGeometry,
        position: SCNVector3,
        color: UIColor
    ) -> SCNNode {
        let material = SCNMaterial()
        material.diffuse.contents = color
        material.roughness.contents = 0.78
        geometry.materials = [material]
        let node = SCNNode(geometry: geometry)
        node.name = "pinata-hit-target"
        node.position = position
        node.categoryBitMask = hitCategory
        parent.addChildNode(node)
        return node
    }

    private func shakePinata() {
        guard let pinataVisual else { return }
        pinataVisual.removeAction(forKey: "hit-shake")
        let left = SCNAction.rotateTo(x: 0.08, y: -0.08, z: 0.16, duration: 0.07, usesShortestUnitArc: true)
        let right = SCNAction.rotateTo(x: -0.06, y: 0.08, z: -0.14, duration: 0.07, usesShortestUnitArc: true)
        let settle = SCNAction.rotateTo(x: 0, y: 0, z: 0, duration: 0.12, usesShortestUnitArc: true)
        pinataVisual.runAction(.sequence([left, right, left, settle]), forKey: "hit-shake")
    }

    private func scheduleNextWander(initial: Bool = false) {
        guard !exploded else { return }
        wanderWorkItem?.cancel()

        let delay = initial ? Double.random(in: 1.2...2.0) : Double.random(in: 1.2...2.0)
        let workItem = DispatchWorkItem { [weak self] in
            self?.relocatePinata(duration: Double.random(in: 2.4...3.3), lift: 0.12, locksHits: false)
        }
        wanderWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }

    private func relocatePinata(duration: TimeInterval, lift: Float, locksHits: Bool) {
        guard !exploded, let pinataRoot else { return }
        wanderWorkItem?.cancel()
        pinataRoot.removeAction(forKey: "relocate")
        hitLocked = locksHits

        let start = pinataRoot.presentation.position
        pinataRoot.position = start
        let target = randomPositionInFrontOfCamera(minDistance: 1.15, maxDistance: 3.2)
        let targetYaw = yawTowardCamera(from: target) + Float.random(in: -.pi / 6 ... .pi / 6)
        let targetTilt = Bool.random() ? Float.random(in: -0.12...0.12) : 0

        let move = SCNAction.customAction(duration: duration) { node, elapsed in
            let raw = Float(elapsed / CGFloat(duration))
            let progress = raw < 0.5
                ? 4 * raw * raw * raw
                : 1 - pow(-2 * raw + 2, 3) / 2
            node.position = SCNVector3(
                start.x + (target.x - start.x) * progress,
                start.y + (target.y - start.y) * progress + sin(progress * .pi) * lift,
                start.z + (target.z - start.z) * progress
            )
        }
        let rotate = SCNAction.rotateTo(x: 0, y: CGFloat(targetYaw), z: CGFloat(targetTilt), duration: duration, usesShortestUnitArc: true)
        rotate.timingMode = .easeInEaseOut

        let finish = SCNAction.run { [weak self] node in
            node.position = target
            self?.hitLocked = false
            self?.scheduleNextWander()
        }
        pinataRoot.runAction(.sequence([.group([move, rotate]), finish]), forKey: "relocate")
    }

    private func randomPositionInFrontOfCamera(minDistance: Float, maxDistance: Float) -> SCNVector3 {
        guard let pointOfView = sceneView.pointOfView else { return SCNVector3(0, -0.1, -1.5) }
        let transform = pointOfView.simdWorldTransform
        let camera = SIMD3<Float>(transform.columns.3.x, transform.columns.3.y, transform.columns.3.z)
        var forward = SIMD3<Float>(-transform.columns.2.x, 0, -transform.columns.2.z)
        if simd_length_squared(forward) < 0.0001 {
            forward = SIMD3<Float>(0, 0, -1)
        } else {
            forward = simd_normalize(forward)
        }
        let right = SIMD3<Float>(forward.z, 0, -forward.x)
        let angle = Float.random(in: -.pi / 5 ... .pi / 5)
        let direction = simd_normalize(forward * cos(angle) + right * sin(angle))
        let distance = Float.random(in: minDistance...maxDistance)
        let position = camera + direction * distance
        return SCNVector3(position.x, camera.y - 0.30, position.z)
    }

    private func orientTowardCamera(_ node: SCNNode, randomOffset: Bool) {
        let offset = randomOffset ? Float.random(in: -.pi / 6 ... .pi / 6) : 0
        node.eulerAngles = SCNVector3(0, yawTowardCamera(from: node.position) + offset, 0)
    }

    private func yawTowardCamera(from position: SCNVector3) -> Float {
        guard let camera = sceneView.pointOfView?.presentation.position else { return 0 }
        let dx = camera.x - position.x
        let dz = camera.z - position.z
        return atan2(-dx, -dz)
    }

    private func explodePinata(at position: SCNVector3) {
        guard !exploded else { return }
        exploded = true
        hitLocked = true
        wanderWorkItem?.cancel()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        emitConfetti(at: position, count: explosionConfettiCount, force: 2.15)

        pinataRoot?.removeAllActions()
        pinataVisual?.runAction(.group([
            .scale(to: 1.28, duration: 0.22),
            .fadeOut(duration: 0.26),
        ]))

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.26) { [weak self] in
            guard let self else { return }
            self.pinataRoot?.removeFromParentNode()
            self.pinataRoot = nil
            self.showFinalReveal(at: position)
        }
    }

    private func showFinalReveal(at position: SCNVector3) {
        showWorldText(at: position)
        showOctopus(at: position)
        startConfettiRain(at: position)

        resetButton.isHidden = false
        UIView.animate(withDuration: 0.3) {
            self.finalLabel.alpha = 1
            self.resetButton.alpha = 1
        }
    }

    private func showWorldText(at position: SCNVector3) {
        let geometry = SCNText(string: "See you soon little one!", extrusionDepth: 0.25)
        geometry.font = UIFont.systemFont(ofSize: 16, weight: .heavy)
        geometry.alignmentMode = CATextLayerAlignmentMode.center.rawValue
        geometry.firstMaterial?.diffuse.contents = theme.primary
        geometry.firstMaterial?.emission.contents = theme.primary.withAlphaComponent(0.28)

        let node = SCNNode(geometry: geometry)
        if let bounds = node.boundingBox {
            let centerX = (bounds.min.x + bounds.max.x) / 2
            let centerY = (bounds.min.y + bounds.max.y) / 2
            node.pivot = SCNMatrix4MakeTranslation(centerX, centerY, 0)
        }
        node.scale = SCNVector3(0.004, 0.004, 0.004)
        node.position = SCNVector3(position.x, position.y + 0.68, position.z)
        let billboard = SCNBillboardConstraint()
        billboard.freeAxes = .Y
        node.constraints = [billboard]
        node.opacity = 0
        sceneView.scene.rootNode.addChildNode(node)
        node.runAction(.fadeIn(duration: 0.35))
        worldTextRoot = node
    }

    private func showOctopus(at position: SCNVector3) {
        let root = makeOctopus()
        root.position = SCNVector3(position.x, position.y - 0.36, position.z)
        root.scale = SCNVector3(0.001, 0.001, 0.001)
        let billboard = SCNBillboardConstraint()
        billboard.freeAxes = .Y
        root.constraints = [billboard]
        sceneView.scene.rootNode.addChildNode(root)

        let appear = SCNAction.scale(to: 0.82, duration: 0.7)
        appear.timingMode = .easeOut
        let bob = SCNAction.sequence([
            .moveBy(x: 0, y: 0.025, z: 0, duration: 0.65),
            .moveBy(x: 0, y: -0.025, z: 0, duration: 0.65),
        ])
        root.runAction(appear)
        root.runAction(.repeatForever(bob), forKey: "octopus-bob")
        octopusRoot = root
    }

    private func makeOctopus() -> SCNNode {
        let root = SCNNode()
        root.name = "baby-octopus"

        let head = SCNNode(geometry: SCNSphere(radius: 0.26))
        head.scale = SCNVector3(1, 1.14, 0.92)
        head.position = SCNVector3(0, 0.30, 0)
        head.geometry?.firstMaterial?.diffuse.contents = theme.primary
        head.geometry?.firstMaterial?.roughness.contents = 0.72
        root.addChildNode(head)

        for x in [-0.085 as Float, 0.085] {
            let eye = SCNNode(geometry: SCNSphere(radius: 0.042))
            eye.scale = SCNVector3(0.8, 1.15, 0.55)
            eye.position = SCNVector3(x, 0.34, -0.225)
            eye.geometry?.firstMaterial?.diffuse.contents = UIColor(red: 0.08, green: 0.16, blue: 0.21, alpha: 1)
            root.addChildNode(eye)

            let glint = SCNNode(geometry: SCNSphere(radius: 0.011))
            glint.position = SCNVector3(x - 0.01, 0.36, -0.252)
            glint.geometry?.firstMaterial?.diffuse.contents = UIColor.white
            root.addChildNode(glint)
        }

        for index in 0..<8 {
            let angle = Float(index) / 8 * .pi * 2
            let pivot = SCNNode()
            pivot.eulerAngles.y = angle
            let tentacle = SCNNode(geometry: SCNCapsule(capRadius: 0.028, height: index.isMultiple(of: 2) ? 0.29 : 0.33))
            tentacle.geometry?.firstMaterial?.diffuse.contents = theme.dark
            tentacle.geometry?.firstMaterial?.roughness.contents = 0.78
            tentacle.eulerAngles.x = .pi / 2
            tentacle.position = SCNVector3(0, 0.075, 0.15)
            pivot.addChildNode(tentacle)

            let tip = SCNNode(geometry: SCNSphere(radius: 0.034))
            tip.position = SCNVector3(0, 0.055, index.isMultiple(of: 2) ? 0.295 : 0.335)
            tip.geometry?.firstMaterial?.diffuse.contents = theme.light
            pivot.addChildNode(tip)
            root.addChildNode(pivot)

            let phaseDelay = SCNAction.wait(duration: Double(index) * 0.035)
            let wave = SCNAction.sequence([
                .rotateBy(x: 0.08, y: 0.05, z: 0.04, duration: 0.55),
                .rotateBy(x: -0.16, y: -0.10, z: -0.08, duration: 0.85),
                .rotateBy(x: 0.08, y: 0.05, z: 0.04, duration: 0.55),
            ])
            pivot.runAction(.sequence([phaseDelay, .repeatForever(wave)]))
        }

        let smilePoints: [SCNVector3] = [
            SCNVector3(-0.055, 0.255, -0.245),
            SCNVector3(0, 0.225, -0.258),
            SCNVector3(0.055, 0.255, -0.245),
        ]
        smilePoints.forEach { point in
            let dot = SCNNode(geometry: SCNSphere(radius: 0.012))
            dot.position = point
            dot.geometry?.firstMaterial?.diffuse.contents = UIColor(red: 0.08, green: 0.16, blue: 0.21, alpha: 1)
            root.addChildNode(dot)
        }
        return root
    }

    private func emitConfetti(at position: SCNVector3, count: Int, force: CGFloat) {
        let system = SCNParticleSystem()
        system.loops = false
        system.birthRate = CGFloat(count) / 0.16
        system.emissionDuration = 0.16
        system.particleLifeSpan = 1.8
        system.particleLifeSpanVariation = 0.65
        system.particleVelocity = 1.25 * force
        system.particleVelocityVariation = 0.75 * force
        system.spreadingAngle = 180
        system.acceleration = SCNVector3(0, -2.7, 0)
        system.particleSize = 0.026
        system.particleSizeVariation = 0.012
        system.particleColor = UIColor(red: 0.35, green: 0.76, blue: 1, alpha: 1)
        system.particleColorVariation = SCNVector4(0.9, 0.9, 0.9, 0)
        system.particleImage = confettiImage()
        system.emitterShape = SCNSphere(radius: 0.08)
        system.birthLocation = .volume
        system.birthDirection = .random

        let emitter = SCNNode()
        emitter.position = position
        emitter.addParticleSystem(system)
        sceneView.scene.rootNode.addChildNode(emitter)
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            emitter.removeFromParentNode()
        }
    }

    private func startConfettiRain(at position: SCNVector3) {
        let system = SCNParticleSystem()
        system.loops = true
        system.birthRate = rainBirthRate
        system.particleLifeSpan = 4.0
        system.particleLifeSpanVariation = 0.7
        system.particleVelocity = 0.65
        system.particleVelocityVariation = 0.2
        system.acceleration = SCNVector3(0, -0.12, 0)
        system.particleSize = 0.028
        system.particleSizeVariation = 0.012
        system.particleColor = theme.primary
        system.particleImage = confettiImage()
        system.emitterShape = SCNBox(width: 3.4, height: 0.04, length: 3.4, chamferRadius: 0)
        system.birthLocation = .volume
        system.birthDirection = .constant
        system.emittingDirection = SCNVector3(0, -1, 0)

        let emitter = SCNNode()
        emitter.position = SCNVector3(position.x, position.y + 2.2, position.z)
        emitter.addParticleSystem(system)
        sceneView.scene.rootNode.addChildNode(emitter)
        rainEmitter = emitter
    }

    private func confettiImage() -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 12, height: 6))
        return renderer.image { context in
            UIColor.white.setFill()
            context.cgContext.fill(CGRect(x: 0, y: 0, width: 12, height: 6))
        }
    }

    private func showStatus(_ message: String) {
        finalLabel.text = message
        finalLabel.textColor = .white
        finalLabel.alpha = 1
    }

    func sessionWasInterrupted(_ session: ARSession) {
        wanderWorkItem?.cancel()
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        start()
    }
}

private extension SCNNode {
    func isDescendant(of ancestor: SCNNode) -> Bool {
        var candidate: SCNNode? = self
        while let node = candidate {
            if node === ancestor { return true }
            candidate = node.parent
        }
        return false
    }
}
