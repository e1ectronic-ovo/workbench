using System.Windows;
using Whaletide.Desktop.Diagnostics;

namespace Whaletide.Desktop;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        if (e.Args.Any(a => string.Equals(a, "--self-test", StringComparison.OrdinalIgnoreCase)))
        {
            var exitCode = SelfTest.Run(this, e.Args);
            Shutdown(exitCode);
            return;
        }

        // --probe：加载完界面后进 WebView2 里取一份 DOM 快照再退出，用于确认 renderer 真的渲染了。
        // 注意这里要写全名：Application.MainWindow 是实例属性，会遮蔽同名类型。
        Whaletide.Desktop.MainWindow.ProbeRequested = e.Args.Any(a =>
            string.Equals(a, "--probe", StringComparison.OrdinalIgnoreCase));

        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
