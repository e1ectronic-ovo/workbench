using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;

namespace Whaletide.Desktop.Diagnostics;

/// <summary>
/// 抓屏幕像素。
///
/// 为什么不用 WPF 的 RenderTargetBitmap：嵌入的模拟器是独立 HWND（airspace），
/// RenderTargetBitmap 只画 WPF 自己的视觉树，抓不到子窗口。
/// 必须从屏幕 DC 取像素，才能回答「嵌进去到底是不是黑屏」。
/// </summary>
internal static class ScreenGrab
{
    private const int SRCCOPY = 0x00CC0020;

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int width, int height);

    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);

    [DllImport("gdi32.dll")]
    private static extern bool BitBlt(
        IntPtr dest, int x, int y, int width, int height,
        IntPtr src, int srcX, int srcY, int rop);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr obj);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr hdc);

    /// <summary>按窗口在屏幕上的实际位置抓一块像素，存成 PNG。返回文件路径或 null。</summary>
    public static string? CaptureWindow(Window window, string filePath)
    {
        var source = PresentationSource.FromVisual(window);
        if (source?.CompositionTarget is null)
        {
            return null;
        }

        var scale = source.CompositionTarget.TransformToDevice;
        var x = (int)Math.Round(window.Left * scale.M11);
        var y = (int)Math.Round(window.Top * scale.M22);
        var width = (int)Math.Round(window.ActualWidth * scale.M11);
        var height = (int)Math.Round(window.ActualHeight * scale.M22);
        if (width <= 0 || height <= 0)
        {
            return null;
        }

        var screenDc = GetDC(IntPtr.Zero);
        if (screenDc == IntPtr.Zero)
        {
            return null;
        }

        var memDc = CreateCompatibleDC(screenDc);
        var bitmap = CreateCompatibleBitmap(screenDc, width, height);
        var previous = SelectObject(memDc, bitmap);
        try
        {
            if (!BitBlt(memDc, 0, 0, width, height, screenDc, x, y, SRCCOPY))
            {
                return null;
            }

            var image = Imaging.CreateBitmapSourceFromHBitmap(
                bitmap, IntPtr.Zero, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(image));
            using var stream = File.Create(filePath);
            encoder.Save(stream);
            return filePath;
        }
        finally
        {
            SelectObject(memDc, previous);
            DeleteObject(bitmap);
            DeleteDC(memDc);
            ReleaseDC(IntPtr.Zero, screenDc);
        }
    }
}
