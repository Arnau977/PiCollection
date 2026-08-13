; Themes the assisted-installer welcome/finish pages to match the app's
; own near-black background and warm off-white text (base.css's
; --color-background / --color-text), instead of NSIS/MUI2's default
; white. Auto-discovered by electron-builder via build/installer.nsh -
; see NsisOptions.include in app-builder-lib.
!define MUI_BGCOLOR 17181D
!define MUI_TEXTCOLOR ECEDE4
