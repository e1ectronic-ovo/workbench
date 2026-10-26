using System.Runtime.InteropServices;
using System.Windows.Interop;
using static Whaletide.Desktop.Native.NativeMethods;

namespace Whaletide.Desktop.Native;

/// <summary>
/// 把一个外部进程的顶层窗口重新 parent 到一个 WPF 子 HWND 里。
/// 这是"真正嵌入"的核心：不经过截图、不经过编码、不经过网络。
/// </summary>
public sealed class NativeWindowHost : HwndHost
{
    private IntPtr _hostHwnd;
    private IntPtr _childHwnd;
    private IntPtr _pendingHwnd;

    private long _originalStyle;
    private long _originalExStyle;
    private IntPtr _originalParent;
    private RECT _originalRect;

    public IntPtr HostHwnd => _hostHwnd;
    public IntPtr ChildHwnd => _childHwnd;
    public bool IsEmbedded => _childHwnd != IntPtr.Zero;

    /// <summary>上一次 Attach 失败时的 Win32 错误码与说明，用于诊断为什么嵌不进去。</summary>
    public int LastError { get; private set; }
    public string LastErrorText { get; private set; } = string.Empty;

    /// <summary>
    /// 是否保持子窗口原始宽高比。
    /// 安卓模拟器是 1080×1920 竖屏，直接拉满横屏容器会变形并裁掉内容，
    /// 所以默认等比缩放 + 上下留边。
    /// </summary>
    public bool PreserveAspect { get; set; } = true;

    /// <summary>把 SetParent 的失败码翻译成人话，避免只报一句「被拒绝」。</summary>
    private static string DescribeReparentFailure(int error) => error switch
    {
        0 => "SetParent 返回空但未设置错误码（窗口可能已被其它进程接管）",
        5 => "ERROR_ACCESS_DENIED：目标进程权限高于本进程，通常需要以相同或更高权限运行",
        87 => "ERROR_INVALID_PARAMETER：窗口句柄或样式非法",
        1400 => "ERROR_INVALID_WINDOW_HANDLE：窗口句柄已失效",
        5023 => "ERROR_INVALID_STATE：两个进程的 DPI 感知模式不一致，跨进程 SetParent 被拒绝",
        _ => $"SetParent 失败，Win32 错误码 {error}"
    };

    public void SetVisible(bool visible)
    {
        if (_childHwnd != IntPtr.Zero && IsWindow(_childHwnd))
        {
            ShowWindow(_childHwnd, visible ? SW_SHOW : SW_HIDE);
        }
    }

    protected override HandleRef BuildWindowCore(HandleRef hwndParent)
    {
        _hostHwnd = CreateWindowEx(
            0,
            "static",
            string.Empty,
            (int)(WS_CHILD | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS),
            0,
            0,
            Math.Max(1, (int)ActualWidth),
            Math.Max(1, (int)ActualHeight),
            hwndParent.Handle,
            IntPtr.Zero,
            IntPtr.Zero,
            IntPtr.Zero);

        if (_pendingHwnd != IntPtr.Zero)
        {
            var pending = _pendingHwnd;
            _pendingHwnd = IntPtr.Zero;
            Embed(pending);
        }

        return new HandleRef(this, _hostHwnd);
    }

    protected override void DestroyWindowCore(HandleRef hwnd)
    {
        Detach();
        if (hwnd.Handle != IntPtr.Zero)
        {
            DestroyWindow(hwnd.Handle);
        }
        _hostHwnd = IntPtr.Zero;
    }

    /// <summary>
    /// 把外部窗口嵌入宿主。宿主尚未创建时先挂起，等 HwndHost 创建完再嵌。
    /// </summary>
    public bool Embed(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !IsWindow(hwnd))
        {
            LastError = Marshal.GetLastPInvokeError();
            LastErrorText = $"窗口句柄已失效（IsWindow=false） handle=0x{hwnd.ToInt64():X}";
            return false;
        }

        if (_hostHwnd == IntPtr.Zero)
        {
            _pendingHwnd = hwnd;
            return true;
        }

        if (_childHwnd == hwnd)
        {
            SyncSize();
            return true;
        }

        Detach();

        _originalParent = GetParent(hwnd);
        _originalStyle = GetWindowLongPtr(hwnd, GWL_STYLE);
        _originalExStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        GetWindowRect(hwnd, out _originalRect);

        // 去掉标题栏 / 边框 / 系统菜单，改成子窗口。
        var style = _originalStyle;
        style &= ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU);
        style |= WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS;
        SetWindowLongPtr(hwnd, GWL_STYLE, style);

        // 不让它在任务栏 / Alt-Tab 里单独出现。
        var exStyle = _originalExStyle;
        exStyle &= ~WS_EX_APPWINDOW;
        exStyle |= WS_EX_TOOLWINDOW;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);

        Marshal.SetLastPInvokeError(0);
        var previousParent = SetParent(hwnd, _hostHwnd);
        var setParentError = Marshal.GetLastPInvokeError();
        if (previousParent == IntPtr.Zero && GetParent(hwnd) != _hostHwnd)
        {
            LastError = setParentError;
            var actualParent = GetParent(hwnd);
            var styleNow = GetWindowLongPtr(hwnd, GWL_STYLE);
            LastErrorText = string.Join(" | ", new[]
            {
                DescribeReparentFailure(setParentError),
                $"parentAfter=0x{actualParent.ToInt64():X}",
                $"expect=0x{_hostHwnd.ToInt64():X}",
                $"styleAfter=0x{styleNow:X}",
                $"isChild={((styleNow & WS_CHILD) != 0)}",
                $"isWindow={IsWindow(hwnd)}"
            });
            // Restore the target if Windows rejected the reparenting operation.
            SetWindowLongPtr(hwnd, GWL_STYLE, _originalStyle);
            SetWindowLongPtr(hwnd, GWL_EXSTYLE, _originalExStyle);
            SetWindowPos(
                hwnd,
                IntPtr.Zero,
                _originalRect.Left,
                _originalRect.Top,
                Math.Max(1, _originalRect.Width),
                Math.Max(1, _originalRect.Height),
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
            return false;
        }

        _childHwnd = hwnd;
        ShowWindow(hwnd, SW_SHOW);
        SetWindowPos(
            hwnd,
            IntPtr.Zero,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        SyncSize();

        return GetParent(hwnd) == _hostHwnd;
    }

    /// <summary>
    /// 解除嵌入，恢复原样式和原来的屏幕位置。
    /// </summary>
    public void Detach()
    {
        if (_childHwnd != IntPtr.Zero && IsWindow(_childHwnd))
        {
            SetParent(_childHwnd, _originalParent);
            SetWindowLongPtr(_childHwnd, GWL_STYLE, _originalStyle);
            SetWindowLongPtr(_childHwnd, GWL_EXSTYLE, _originalExStyle);
            SetWindowPos(
                _childHwnd,
                IntPtr.Zero,
                _originalRect.Left,
                _originalRect.Top,
                Math.Max(1, _originalRect.Width),
                Math.Max(1, _originalRect.Height),
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
        }

        _childHwnd = IntPtr.Zero;
        _pendingHwnd = IntPtr.Zero;
    }

    /// <summary>把子窗口同步成宿主客户区大小。自检和 WM_SIZE 都会调用。</summary>
    public void SyncSize()
    {
        if (_childHwnd == IntPtr.Zero || _hostHwnd == IntPtr.Zero)
        {
            return;
        }
        if (!GetClientRect(_hostHwnd, out var rect))
        {
            return;
        }

        var x = 0;
        var y = 0;
        var width = Math.Max(1, rect.Width);
        var height = Math.Max(1, rect.Height);

        if (PreserveAspect && _originalRect.Width > 0 && _originalRect.Height > 0)
        {
            var scale = Math.Min(
                (double)rect.Width / _originalRect.Width,
                (double)rect.Height / _originalRect.Height);
            width = Math.Max(1, (int)Math.Round(_originalRect.Width * scale));
            height = Math.Max(1, (int)Math.Round(_originalRect.Height * scale));
            x = Math.Max(0, (rect.Width - width) / 2);
            y = Math.Max(0, (rect.Height - height) / 2);
        }

        SetWindowPos(
            _childHwnd,
            IntPtr.Zero,
            x,
            y,
            width,
            height,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }

    protected override IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        switch (msg)
        {
            case WM_SIZE:
                SyncSize();
                break;
            case WM_SETFOCUS:
                if (_childHwnd != IntPtr.Zero)
                {
                    SetFocus(_childHwnd);
                }
                break;
        }

        return base.WndProc(hwnd, msg, wParam, lParam, ref handled);
    }
}
