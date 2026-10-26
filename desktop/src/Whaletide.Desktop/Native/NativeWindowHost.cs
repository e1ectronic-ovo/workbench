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

    /// <summary>
    /// 是否保持子窗口原始宽高比。
    /// 安卓模拟器是 1080×1920 竖屏，直接拉满横屏容器会变形并裁掉内容，
    /// 所以默认等比缩放 + 上下留边。
    /// </summary>
    public bool PreserveAspect { get; set; } = true;

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

        var previousParent = SetParent(hwnd, _hostHwnd);
        if (previousParent == IntPtr.Zero && GetParent(hwnd) != _hostHwnd)
        {
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
