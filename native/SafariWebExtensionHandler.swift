import SafariServices
import AppKit
import os.log

/// Writes TabVault files into ~/Downloads/TabVault.
/// Safety: only ever CREATES or APPENDS inside that one folder. It never deletes or overwrites anything.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private var vaultURL: URL {
        // Real home folder (not the sandbox container path)
        let home: String
        if let pw = getpwuid(getuid()), let dir = pw.pointee.pw_dir { home = String(cString: dir) }
        else { home = NSHomeDirectory() }
        return URL(fileURLWithPath: home).appendingPathComponent("Downloads/TabVault", isDirectory: true)
    }

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message: Any?
        if #available(macOS 11.0, *) { message = item?.userInfo?[SFExtensionMessageKey] }
        else { message = item?.userInfo?["message"] }

        var reply: [String: Any] = ["ok": false, "error": "Unknown request"]
        if let dict = message as? [String: Any], let action = dict["action"] as? String {
            switch action {
            case "save":   reply = save(dict)
            case "reveal": reply = reveal()
            case "ping":   reply = ["ok": true]
            default: break
            }
        }

        let response = NSExtensionItem()
        if #available(macOS 11.0, *) { response.userInfo = [SFExtensionMessageKey: reply] }
        else { response.userInfo = ["message": reply] }
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    /// Returns a file URL that does not exist yet ("name.pdf", "name (2).pdf", …).
    private func uniqueURL(_ base: String, _ ext: String) -> URL {
        let fm = FileManager.default
        var url = vaultURL.appendingPathComponent("\(base).\(ext)")
        var i = 2
        while fm.fileExists(atPath: url.path) {
            url = vaultURL.appendingPathComponent("\(base) (\(i)).\(ext)"); i += 1
        }
        return url
    }

    private func safeName(_ s: String) -> String {
        let bad = CharacterSet(charactersIn: "/:\\\0")
        let cleaned = s.components(separatedBy: bad).joined(separator: "-")
        return String(cleaned.prefix(80))
    }

    private func save(_ msg: [String: Any]) -> [String: Any] {
        let fm = FileManager.default
        do {
            try fm.createDirectory(at: vaultURL, withIntermediateDirectories: true)
            let base = "Tabs " + safeName(msg["stamp"] as? String ?? "\(Date().timeIntervalSince1970)")
            var out: [String: Any] = ["ok": true, "folder": vaultURL.path]

            if let b64 = msg["pdf"] as? String, let data = Data(base64Encoded: b64) {
                let url = uniqueURL(base, "pdf")
                try data.write(to: url, options: .withoutOverwriting)
                out["pdf"] = url.lastPathComponent
            }
            if let html = msg["html"] as? String {
                let url = uniqueURL(base, "html")
                try Data(html.utf8).write(to: url, options: .withoutOverwriting)
                out["html"] = url.lastPathComponent
            }
            if let log = msg["log"] as? String {
                try appendLog(log)
                out["log"] = "TabVault Log.csv"
            }
            return out
        } catch {
            os_log(.error, "TabVault save failed: %{public}@", error.localizedDescription)
            return ["ok": false, "error": error.localizedDescription]
        }
    }

    /// Append-only history log: Date, Time, Session, Window, #, Title, URL
    private func appendLog(_ text: String) throws {
        let url = vaultURL.appendingPathComponent("TabVault Log.csv")
        let fm = FileManager.default
        if !fm.fileExists(atPath: url.path) {
            let header = "\u{FEFF}Date,Time,Session,Window,#,Title,URL\n"
            try Data(header.utf8).write(to: url, options: .withoutOverwriting)
        }
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        handle.seekToEndOfFile()
        handle.write(Data(text.utf8))
    }

    private func reveal() -> [String: Any] {
        try? FileManager.default.createDirectory(at: vaultURL, withIntermediateDirectories: true)
        let ok = NSWorkspace.shared.open(vaultURL)
        return ["ok": ok]
    }
}
