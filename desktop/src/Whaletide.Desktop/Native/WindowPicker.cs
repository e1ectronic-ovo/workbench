using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace Whaletide.Desktop.Native;

/// <summary>列出当前所有顶层窗口，供手动选择要嵌入的目标（模拟器、播放器等）。</summary>
public static class WindowPicker
{
    public static WindowInfo? Pick(Window owner)
    {
        var list = new ListBox
        {
            Margin = new Thickness(0, 8, 0, 8),
            Background = new SolidColorBrush(Color.FromRgb(0x0B, 0x0D, 0x12)),
            Foreground = new SolidColorBrush(Color.FromRgb(0xE7, 0xEC, 0xF3)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(0x26, 0x30, 0x41)),
            FontFamily = new FontFamily("Microsoft YaHei UI"),
            FontSize = 12
        };

        var hint = new TextBlock
        {
            Text = "选择一个窗口嵌入（模拟器请先启动到主界面）：",
            Foreground = new SolidColorBrush(Color.FromRgb(0x7A, 0x84, 0x96)),
            FontFamily = new FontFamily("Microsoft YaHei UI"),
            FontSize = 12
        };

        var refresh = new Button { Content = "刷新", Width = 88, Height = 32, Margin = new Thickness(0, 0, 8, 0) };
        var ok = new Button { Content = "嵌入", Width = 88, Height = 32, Margin = new Thickness(0, 0, 8, 0), IsDefault = true };
        var cancel = new Button { Content = "取消", Width = 88, Height = 32, IsCancel = true };

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right
        };
        buttons.Children.Add(refresh);
        buttons.Children.Add(ok);
        buttons.Children.Add(cancel);

        var root = new Grid { Margin = new Thickness(16) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        Grid.SetRow(hint, 0);
        Grid.SetRow(list, 1);
        Grid.SetRow(buttons, 2);
        root.Children.Add(hint);
        root.Children.Add(list);
        root.Children.Add(buttons);

        var dialog = new Window
        {
            Title = "选择要嵌入的窗口",
            Owner = owner,
            Width = 880,
            Height = 560,
            MinWidth = 640,
            MinHeight = 400,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Background = new SolidColorBrush(Color.FromRgb(0x0E, 0x11, 0x17)),
            Content = root,
            ShowInTaskbar = false
        };

        void Reload()
        {
            var items = WindowLocator.EnumerateTopLevelWindows();
            list.ItemsSource = items;
            list.DisplayMemberPath = nameof(WindowInfo.Display);
            if (items.Count > 0)
            {
                list.SelectedIndex = 0;
            }
        }

        refresh.Click += (_, _) => Reload();
        ok.Click += (_, _) =>
        {
            if (list.SelectedItem is WindowInfo)
            {
                dialog.DialogResult = true;
            }
        };

        Reload();
        return dialog.ShowDialog() == true ? list.SelectedItem as WindowInfo : null;
    }
}