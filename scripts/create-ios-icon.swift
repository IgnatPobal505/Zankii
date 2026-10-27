// Run on macOS: swift scripts/create-ios-icon.swift
// Original code-drawn Fat Wave artwork, matching render.js; no downloaded sprite.
import AppKit

let width = 1024
let context = CGContext(data: nil, width: width, height: width, bitsPerComponent: 8,
    bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.setFillColor(CGColor(red: 0.063, green: 0.078, blue: 0.137, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: width))
context.setStrokeColor(CGColor(red: 0.20, green: 0.28, blue: 0.43, alpha: 1))
context.setLineWidth(3)
for inset in [100.0, 150.0] {
    context.strokeEllipse(in: CGRect(x: inset, y: inset, width: 1024 - 2 * inset, height: 1024 - 2 * inset))
}
context.translateBy(x: 512, y: 512)
context.rotate(by: .pi / 4)
context.scaleBy(x: 12.5, y: 12.5)
context.beginPath()
context.addArc(center: CGPoint(x: -3, y: 0), radius: 24, startAngle: .pi * 0.31, endAngle: .pi * 1.69, clockwise: false)
context.addLine(to: CGPoint(x: 22, y: 0))
context.closePath()
context.setFillColor(CGColor(red: 0.094, green: 0.231, blue: 0.549, alpha: 1))
context.setStrokeColor(CGColor(red: 0.66, green: 0.77, blue: 1, alpha: 1))
context.setLineWidth(1.5)
context.drawPath(using: .fillStroke)
context.setFillColor(CGColor(red: 0.49, green: 0, blue: 1, alpha: 1))
context.fillEllipse(in: CGRect(x: -20, y: -14, width: 28, height: 28))
for y in [-21.0, 15.0] { context.fill(CGRect(x: 17, y: y, width: 11, height: 6)) }
let image = NSBitmapImageRep(cgImage: context.makeImage()!)
let output = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("ios/Zankii/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
try image.representation(using: .png, properties: [:])!.write(to: output)
print("Created opaque 1024×1024 AppIcon.png")
