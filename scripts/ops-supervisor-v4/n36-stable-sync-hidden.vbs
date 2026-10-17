Option Explicit
Dim shell, result, q
q = Chr(34)
Set shell = CreateObject("WScript.Shell")
result = shell.Run(q & "C:\Program Files\nodejs\node.exe" & q & " " & q & "C:\Users\Abody\Projects\RakeezX\scripts\ops-supervisor-v4\n36-stable-sync.mjs" & q & " --once", 0, True)
WScript.Quit result
