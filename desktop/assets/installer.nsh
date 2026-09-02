!include nsDialogs.nsh
!include LogicLib.nsh

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!ifndef BUILD_UNINSTALLER
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Selamat Datang di Setup Malesan Studio"
    !define MUI_WELCOMEPAGE_TEXT "Malesan Studio adalah platform AI all-in-one untuk konten kreator Indonesia.$\r$\n$\r$\nWizard ini akan membantu kamu:$\r$\n• Menentukan folder penyimpanan aplikasi$\r$\n• Mengatur folder hasil download & video klip$\r$\n• Membuat icon shortcut di Desktop$\r$\n$\r$\nKlik 'Lanjut' untuk memulai."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !define MUI_DIRECTORYPAGE_TEXT_TOP "Setup akan memasang Malesan Studio di folder berikut. Untuk memilih folder lain, klik Cari."
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Folder Lokasi Instalasi"

  !define MUI_FINISHPAGE_TITLE "Instalasi Malesan Studio Selesai"
  !define MUI_FINISHPAGE_TEXT "Aplikasi Malesan Studio berhasil dipasang di komputer kamu.$\r$\nShortcut telah dibuat di Desktop untuk akses cepat.$\r$\n$\r$\nKlik 'Selesai' untuk mulai berkreasi."
  !define MUI_FINISHPAGE_RUN_TEXT "Jalankan Malesan Studio sekarang"

  Var CustomDialog
  Var CheckboxDesktop
  Var TextDataDir
  Var BtnBrowseDataDir

  Var DesktopShortcutState
  Var CustomDataDir

  Function ShowCustomOptionsPage
    nsDialogs::Create 1018
    Pop $CustomDialog
    ${If} $CustomDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 14u "Pengaturan Shortcut Desktop & Folder Video"
    Pop $0

    ${NSD_CreateCheckbox} 0 20u 100% 12u "Buat shortcut Malesan Studio di Desktop"
    Pop $CheckboxDesktop
    ${NSD_Check} $CheckboxDesktop

    ${NSD_CreateLabel} 0 45u 100% 12u "Folder Penyimpanan Hasil Download & Video Klip:"
    Pop $0

    ${NSD_CreateText} 0 60u 75% 13u "$PROFILE\Videos\Malesan"
    Pop $TextDataDir

    ${NSD_CreateButton} 77% 59u 23% 15u "Cari..."
    Pop $BtnBrowseDataDir
    ${NSD_OnClick} $BtnBrowseDataDir OnBrowseDataDir

    nsDialogs::Show
  FunctionEnd

  Function OnBrowseDataDir
    Pop $0
    nsDialogs::SelectFolderDialog "Pilih Folder Penyimpanan Video Malesan" "$PROFILE\Videos"
    Pop $0
    ${If} $0 != error
      ${NSD_SetText} $TextDataDir $0
    ${EndIf}
  FunctionEnd

  Function LeaveCustomOptionsPage
    ${NSD_GetState} $CheckboxDesktop $DesktopShortcutState
    ${NSD_GetText} $TextDataDir $CustomDataDir

    ${If} $CustomDataDir == ""
      StrCpy $CustomDataDir "$PROFILE\Videos\Malesan"
    ${EndIf}
  FunctionEnd

  !macro customPageAfterChangeDir
    Page custom ShowCustomOptionsPage LeaveCustomOptionsPage
  !macroend

  !macro customInstall
    # Save chosen video directory into Registry
    WriteRegStr HKCU "Software\Malesan Studio" "DataDir" "$CustomDataDir"
    CreateDirectory "$CustomDataDir"

    # Create Desktop shortcut if checked
    ${If} $DesktopShortcutState == 1
      CreateShortCut "$DESKTOP\Malesan Studio.lnk" "$INSTDIR\Malesan Studio.exe" "" "$INSTDIR\Malesan Studio.exe" 0
    ${EndIf}

    # Always create Start Menu folder with App and Uninstaller
    CreateDirectory "$SMPROGRAMS\Malesan Studio"
    CreateShortCut "$SMPROGRAMS\Malesan Studio\Malesan Studio.lnk" "$INSTDIR\Malesan Studio.exe" "" "$INSTDIR\Malesan Studio.exe" 0
    CreateShortCut "$SMPROGRAMS\Malesan Studio\Uninstall Malesan Studio.lnk" "$INSTDIR\Uninstall Malesan Studio.exe" "" "$INSTDIR\Uninstall Malesan Studio.exe" 0
  !macroend
!endif

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKCU "Software\Malesan Studio" "DataDir"
    ${If} $0 == ""
      StrCpy $0 "$PROFILE\Videos\Malesan"
    ${EndIf}

    ${ifNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION "Apakah kamu ingin menghapus seluruh data dan video hasil clip di folder ($0) juga?$\n$\n• Pilih 'Yes' (Ya): Hapus bersih total (aplikasi dan seluruh video dihapus).$\n• Pilih 'No' (Tidak): Hanya hapus aplikasi (semua file video kamu tetap tersimpan aman)." IDYES deleteData IDNO keepData
    ${else}
      Goto keepData
    ${endif}

    deleteData:
      RMDir /r "$0"
      DeleteRegKey HKCU "Software\Malesan Studio"
      Goto finishUninstall

    keepData:
      DeleteRegKey HKCU "Software\Malesan Studio"

    finishUninstall:
  ${endif}
!macroend
