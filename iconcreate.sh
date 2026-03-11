mkdir MyApp.iconset

sips -z 16 16     ./assets/logo.jpeg --out MyApp.iconset/icon_16x16.jpg
sips -z 32 32     ./assets/logo.jpeg --out MyApp.iconset/icon_16x16@2x.jpg
sips -z 32 32     ./assets/logo.jpeg --out MyApp.iconset/icon_32x32.jpg
sips -z 64 64     ./assets/logo.jpeg --out MyApp.iconset/icon_32x32@2x.jpg
sips -z 128 128   ./assets/logo.jpeg --out MyApp.iconset/icon_128x128.jpg
sips -z 256 256   ./assets/logo.jpeg --out MyApp.iconset/icon_128x128@2x.jpg
sips -z 256 256   ./assets/logo.jpeg --out MyApp.iconset/icon_256x256.jpg
sips -z 512 512   ./assets/logo.jpeg --out MyApp.iconset/icon_256x256@2x.jpg
sips -z 512 512   ./assets/logo.jpeg --out MyApp.iconset/icon_512x512.jpg
cp ./assets/logo.jpeg MyApp.iconset/icon_512x512@2x.jpg

iconutil -c icns MyApp.iconset