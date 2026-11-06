# Void OS

A fully functional web-based operating system running entirely in your browser.

**Live:** https://tvmanisback.github.io/Void/

## Features

- Complete desktop environment (windows, taskbar, start menu, desktop icons)
- **Void Browser** – Real proxy-powered browser (not an embed)
- **VoidCode** – VSCode-style code editor powered by Monaco
- Draggable / resizable windows
- Dark "void" theme
- Clock, system tray, and settings

## Notes

This is a client-side OS simulation. The browser uses public CORS proxies to fetch pages. Complex modern sites may not render perfectly due to how proxies handle relative assets, CSP, and scripts.

Schools that block `*.github.io` will of course block this site too.

## Tech

- Pure HTML / CSS / JavaScript
- Monaco Editor (CDN)
- No build step required
