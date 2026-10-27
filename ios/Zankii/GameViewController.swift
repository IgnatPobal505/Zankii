import SafariServices
import UIKit
import WebKit

/// The game engine stays shared with the browser version. The app owns lifecycle,
/// offline resources, navigation and device behavior; the page owns game controls.
final class GameViewController: UIViewController {
    private var webView: WKWebView!
    private var webRoot: URL?
    private var sceneIsActive = false
    private var gameIsPlaying = false
    private var errorView: UIView?

    override var prefersStatusBarHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeRight }
    override var prefersHomeIndicatorAutoHidden: Bool { gameIsPlaying }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        gameIsPlaying ? [.bottom] : []
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 16 / 255, green: 20 / 255, blue: 35 / 255, alpha: 1)

        let contentController = WKUserContentController()
        contentController.add(WeakGameMessageHandler(owner: self), name: "zankiiGame")
        contentController.addUserScript(WKUserScript(source: """
            window.zankiiNative = Object.freeze({platform: 'ios'});
            (() => {
                const markNative = () => document.documentElement?.classList.add('native-ios');
                markNative();
                document.addEventListener('DOMContentLoaded', markNative, {once: true});
            })();
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.applicationNameForUserAgent = "Zankii-iOS/0.3"

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.delaysContentTouches = false
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isMultipleTouchEnabled = true
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        loadGame()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        refreshLifecycle()
    }

    func setSceneActive(_ active: Bool) {
        sceneIsActive = active
        guard isViewLoaded else { return }
        refreshLifecycle()
    }

    private func refreshLifecycle() {
        let active = sceneIsActive && view.window != nil && presentedViewController == nil && errorView == nil
        if !active {
            setPlaying(false)
            webView.pauseAllMediaPlayback(completionHandler: nil)
        }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('zankii:lifecycle', {detail: {active: \(active ? "true" : "false")}}));", completionHandler: nil)
    }

    private func setPlaying(_ playing: Bool) {
        gameIsPlaying = playing && sceneIsActive && presentedViewController == nil && errorView == nil
        UIApplication.shared.isIdleTimerDisabled = gameIsPlaying
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }

    fileprivate func receive(_ message: WKScriptMessage) {
        guard message.name == "zankiiGame",
              message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url,
              isGameURL(url),
              let payload = message.body as? [String: Any],
              payload["type"] as? String == "playing",
              let playing = payload["value"] as? Bool else { return }
        setPlaying(playing)
    }

    @objc private func loadGame() {
        setPlaying(false)
        errorView?.removeFromSuperview()
        errorView = nil
        do {
            let root = try prepareOfflineResources()
            webRoot = root
            webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        } catch {
            showLoadError()
        }
    }

    /// Keep the file origin stable across app updates, even when iOS changes the
    /// .app bundle's UUID. WebKit's persistent store then keeps the same records.
    private func prepareOfflineResources() throws -> URL {
        let files = FileManager.default
        guard let bundledWeb = Bundle.main.url(forResource: "Web", withExtension: nil) else {
            throw CocoaError(.fileNoSuchFile)
        }
        let support = try files.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let destination = support.appendingPathComponent("ZankiiWeb", isDirectory: true)
        let incoming = support.appendingPathComponent("ZankiiWeb.incoming", isDirectory: true)
        if files.fileExists(atPath: incoming.path) { try files.removeItem(at: incoming) }
        try files.copyItem(at: bundledWeb, to: incoming)
        guard files.fileExists(atPath: incoming.appendingPathComponent("index.html").path) else {
            throw CocoaError(.fileNoSuchFile)
        }
        if files.fileExists(atPath: destination.path) { try files.removeItem(at: destination) }
        try files.moveItem(at: incoming, to: destination)
        var excludedDestination = destination
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try excludedDestination.setResourceValues(values)
        return destination
    }

    private func isGameURL(_ url: URL) -> Bool {
        guard url.isFileURL, let webRoot else { return false }
        let path = url.standardizedFileURL.resolvingSymlinksInPath().path
        let root = webRoot.standardizedFileURL.resolvingSymlinksInPath().path
        return path.hasPrefix(root + "/")
    }

    private func showLoadError() {
        setPlaying(false)
        guard errorView == nil else { return }
        let panel = UIView()
        panel.backgroundColor = view.backgroundColor
        panel.translatesAutoresizingMaskIntoConstraints = false
        let message = UILabel()
        message.text = "Zankii could not load.\nTry reopening the game."
        message.textColor = .white
        message.font = .preferredFont(forTextStyle: .headline)
        message.textAlignment = .center
        message.numberOfLines = 0
        let retry = UIButton(type: .system)
        retry.setTitle("Reload game", for: .normal)
        retry.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        retry.addTarget(self, action: #selector(loadGame), for: .touchUpInside)
        retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        let stack = UIStackView(arrangedSubviews: [message, retry])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)
        view.addSubview(panel)
        NSLayoutConstraint.activate([
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.topAnchor.constraint(equalTo: view.topAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.centerXAnchor.constraint(equalTo: panel.safeAreaLayoutGuide.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: panel.safeAreaLayoutGuide.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: panel.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: panel.safeAreaLayoutGuide.trailingAnchor, constant: -24)
        ])
        errorView = panel
        refreshLifecycle()
    }

    private func openExternalLink(_ url: URL) {
        guard url.scheme?.lowercased() == "https", presentedViewController == nil else { return }
        setPlaying(false)
        webView.pauseAllMediaPlayback(completionHandler: nil)
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('zankii:lifecycle', {detail: {active: false}}));", completionHandler: nil)
        let browser = SFSafariViewController(url: url)
        browser.delegate = self
        present(browser, animated: true)
    }
}

extension GameViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshLifecycle()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if isGameURL(url), navigationAction.targetFrame?.isMainFrame == true {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated { openExternalLink(url) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showLoadError() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showLoadError() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        setPlaying(false)
        // Recover at the menu/ready screen. An interrupted run never auto-resumes.
        if let webRoot {
            webView.loadFileURL(webRoot.appendingPathComponent("index.html"), allowingReadAccessTo: webRoot)
        } else {
            showLoadError()
        }
    }
}

extension GameViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // target=_blank is handled in navigation policy and never gets a game bridge.
        nil
    }
}

extension GameViewController: SFSafariViewControllerDelegate {
    func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        controller.dismiss(animated: true) { [weak self] in self?.refreshLifecycle() }
    }
}

private final class WeakGameMessageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GameViewController?
    init(owner: GameViewController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receive(message)
    }
}
