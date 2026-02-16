// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Printyx",
    platforms: [
        .iOS(.v17)
    ],
    dependencies: [
        .package(url: "https://github.com/supabase-community/supabase-swift.git", from: "2.0.0"),
        .package(url: "https://github.com/airbnb/lottie-spm.git", from: "4.4.0"),
    ],
    targets: [
        .target(
            name: "Printyx",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "Lottie", package: "lottie-spm"),
            ],
            path: "Printyx"
        ),
        .testTarget(
            name: "PrintyxTests",
            dependencies: ["Printyx"],
            path: "PrintyxTests"
        ),
    ]
)
