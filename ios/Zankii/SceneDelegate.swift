import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = GameViewController()
        window.overrideUserInterfaceStyle = .dark
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        gameController?.setSceneActive(true)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        gameController?.setSceneActive(false)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        gameController?.setSceneActive(false)
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        gameController?.setSceneActive(false)
    }

    private var gameController: GameViewController? {
        window?.rootViewController as? GameViewController
    }
}
