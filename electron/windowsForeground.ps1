# Eden.exe Windows foreground-window fallback.
# Reads "NEXT" lines from stdin and writes one compact JSON snapshot per line.
# It does not inspect keystrokes, mouse activity, screen pixels, or window contents.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class EdenForegroundWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
}
'@

while (($command = [Console]::ReadLine()) -ne $null) {
    if ($command -ne 'NEXT') { continue }
    try {
        $handle = [EdenForegroundWindow]::GetForegroundWindow()
        if ($handle -eq [IntPtr]::Zero) {
            [Console]::Out.WriteLine('{"appName":"","windowTitle":"","executable":""}')
            continue
        }
        $processId = [uint32]0
        [void][EdenForegroundWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
        $title = New-Object System.Text.StringBuilder 2048
        [void][EdenForegroundWindow]::GetWindowText($handle, $title, $title.Capacity)
        $process = [System.Diagnostics.Process]::GetProcessById([int]$processId)
        $snapshot = @{
            appName = [string]$process.ProcessName
            windowTitle = [string]$title.ToString()
            executable = [string]($process.ProcessName + '.exe')
        }
        [Console]::Out.WriteLine(($snapshot | ConvertTo-Json -Compress -Depth 2))
    } catch {
        [Console]::Out.WriteLine('{"appName":"","windowTitle":"","executable":""}')
    }
}
