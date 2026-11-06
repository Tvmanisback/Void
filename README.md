# Void OS

A fully functional web-based operating system running entirely in your browser.

**Live:** https://tvmanisback.github.io/Void/

## Features

- Complete desktop environment (windows, taskbar, start menu, desktop icons)
- **SVG icons** for every app
- **Void Browser** – Real proxy-powered browser (corsproxy.io)
- **VoidCode** – VS Code-style editor with activity bar, sidebar, tabs, status bar (Monaco)
- **Terminal** – Interactive command line
- **Files** – Local file manager
- **Notes** – Notes app with localStorage
- **TycoreStore** – App store
- Clock format: `DD/MM/YYYY` + `HH:MM`
- Draggable / resizable windows
- Dark void theme

## Notes

Everything runs client-side. Notes and files are stored in localStorage.
A real backend (Supabase) can be added later for cloud sync.

## Tech

- Pure HTML / CSS / JavaScript
- Monaco Editor (CDN)
- No build step required
