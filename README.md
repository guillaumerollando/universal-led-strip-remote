# Universal LED Strip Remote

One free Android app for your Bluetooth and infrared LED strips. No ads, no account, no tracking.

Most cheap LED strip controllers sold online each come with their own app. This one brings them together:

- **Bluetooth strips** (ELK-BLEDOM, ELK-BLEDOB, MELK…): on/off, any color, white, brightness, built-in effects and speed
- **Infrared strips**: if your phone has an IR blaster (many Xiaomi, Redmi and POCO phones do), it becomes the remote
- **Other controllers** (Bluetooth and Wi-Fi): recognized, and the app tells you which maker app they belong to

Available in 25 languages. Store listing texts live in [`store/metadata`](store/metadata).

## Build

Expo / React Native app, managed with pnpm.

```bash
pnpm install
pnpm test
npx expo run:android
```

Release signing reads its passwords from environment variables (see [`plugins/withReleaseSigning.js`](plugins/withReleaseSigning.js)); without them, the build uses the debug key.

## Contributing

Bug reports and support for new LED controllers are welcome: open an issue with the controller name (as shown in Bluetooth settings) and, if possible, the app it normally uses.

## License

[GNU GPL v3.0](LICENSE) © Rollando Studio. You may reuse and modify this code, but any app you distribute based on it must also publish its source code under the GPL.
