; 安装向导自定义脚本（electron-builder 默认加载 build/installer.nsh）
;
; 作用：在「选择安装位置」之后插入一页「选择附加任务」，让用户决定是否创建桌面快捷方式。
;
; 实现说明：
; electron-builder 的 addDesktopLink 先按 createDesktopShortcut 配置建好快捷方式，
; customInstall 在它之后执行，所以这里采取「先建后删」——不覆盖它的建链逻辑，
; 卸载器仍然能按 $oldDesktopLink 正常清理，不会留下删不掉的残留快捷方式。
;
; 升级安装（${isUpdated}）跳过该页：不打扰用户，也避免把用户主动删掉的快捷方式又建回来。
;
; 注意：electron-builder 会把本文件 !include 到 installer.nsi 模板的*最前面*，
; 而 MUI2.nsh 是模板第 9 行才包含的。页头文本要在 Function 体内展开
; MUI_HEADER_TEXT 宏，所以这里必须自己把 MUI2 带进来（MUI2 有包含守卫，重复 include 无害），
; 另外文件必须带 UTF-8 BOM，否则 makensis 会把中文按 ANSI 读出乱码。

!ifndef MUI_INCLUDED
  !include "MUI2.nsh"
!endif
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var customDesktopCheckbox
Var customCreateDesktopShortcut
!endif

!macro customPageAfterChangeDir
  Page custom customDesktopPageCreate customDesktopPageLeave
!macroend

; 函数定义必须放在 customHeader 里：electron-builder 生成的脚本会把自定义 include
; 排在 !addplugindir 之前，而 ${isUpdated} 会展开成 StdUtils 插件调用；直接在这里
; 展开会报 “Plugin not found”。customHeader 在插件目录注册之后才插入。
!macro customHeader
!ifndef BUILD_UNINSTALLER
Function customDesktopPageCreate
  ${if} ${isUpdated}
    Abort
  ${endif}

  !insertmacro MUI_HEADER_TEXT "选择附加任务" "请选择安装程序要执行的附加任务，然后点击「安装」。"

  nsDialogs::Create 1018
  Pop $0
  ${if} $0 == error
    Abort
  ${endif}

  ${NSD_CreateCheckbox} 0 0 100% 12u "创建桌面快捷方式(&D)"
  Pop $customDesktopCheckbox
  ${NSD_Check} $customDesktopCheckbox
  StrCpy $customCreateDesktopShortcut "true"

  nsDialogs::Show
FunctionEnd

Function customDesktopPageLeave
  ${NSD_GetState} $customDesktopCheckbox $0
  ${if} $0 == ${BST_CHECKED}
    StrCpy $customCreateDesktopShortcut "true"
  ${else}
    StrCpy $customCreateDesktopShortcut "false"
  ${endif}
FunctionEnd
!endif
!macroend

!macro customInstall
  ${if} $customCreateDesktopShortcut == "false"
    ${if} ${FileExists} "$newDesktopLink"
      ; 先解除 AppUserModelID 关联，再删文件，避免 shell 里留下失效项
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${endif}
  ${endif}
!macroend
